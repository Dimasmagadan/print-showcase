"""Local W3C WebDriver acceptance runner; never publishes or changes browser settings.
Start safaridriver :4445 or geckodriver :4446 separately. Uses isolated sessions.
"""
from pathlib import Path
import argparse
import base64
import json
import time
import io
from PIL import Image
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--browser', choices=['firefox', 'safari'], required=True)
parser.add_argument('--url', default='http://127.0.0.1:4324/models/robot-cat/')
parser.add_argument('--static-only', action='store_true')
parser.add_argument('--reduced', action='store_true')
parser.add_argument('--zoom-only', action='store_true')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/design/robot-cat-redesign/acceptance' / args.browser
OUT.mkdir(parents=True, exist_ok=True)
endpoint = 'http://127.0.0.1:' + ('4447' if args.zoom_only else '4446' if args.browser == 'firefox' else '4445')

def request(path, data=None, method=None):
    raw = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(endpoint + path, data=raw, method=method or ('POST' if data is not None else 'GET'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=45) as r: result=json.load(r)['value']
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()) from e
    if isinstance(result, dict) and 'error' in result: raise RuntimeError(result)
    return result

cap = {'browserName': args.browser}
if args.browser == 'firefox':
    cap['moz:firefoxOptions'] = {'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox', 'args':['-headless'], 'prefs': {'ui.prefersReducedMotion':int(args.reduced)}}
created = request('/session', {'capabilities':{'alwaysMatch':cap}})
session = '/session/' + created['sessionId']
report = {'browser':created['capabilities'], 'url':args.url, 'reduced':args.reduced, 'checks':[]}
def execute(script, *values): return request(session+'/execute/sync', {'script':script,'args':list(values)})
def wait(script, *values):
    end=time.monotonic()+25
    while time.monotonic()<end:
        value=execute(script,*values)
        if value: return value
        time.sleep(.08)
    raise RuntimeError('Timed out: '+script)
capture_width = None
def screenshot(name):
    raw=base64.b64decode(request(session+'/screenshot'))
    if capture_width:
        im=Image.open(io.BytesIO(raw)); im.crop((0,0,capture_width[0],capture_width[1])).save(OUT / name)
    else: (OUT / name).write_bytes(raw)
try:
    for width,height in ([] if args.zoom_only else [(1440,900),(1920,1080),(1024,768),(390,844),(360,640)]):
        request(session+'/frame', {'id':None})
        request(session+'/window/rect', {'width':max(500,width),'height':height})
        request(session+'/url', {'url':args.url})
        # WebDriver sizes the outer window; correct for browser chrome.
        inner=execute('return [innerWidth,innerHeight]')
        request(session+'/window/rect',{'width':max(500,width)+max(500,width)-inner[0],'height':height+height-inner[1]})
        capture_width = (width,height) if width<500 else None
        if width<500:
            frame=execute('document.body.replaceChildren();document.body.style.margin="0";const f=document.createElement("iframe");f.style.cssText="display:block;border:0";f.width=arguments[0];f.height=arguments[1];f.src=arguments[2];document.body.appendChild(f);return f',width,height,args.url)
            request(session+'/frame', {'id':frame})
        wait('return document.querySelector(".robot-cat-story") && document.readyState === "complete"')
        if not args.static_only and not args.reduced and width>=1440:
            execute('document.querySelector(".story-scene").scrollIntoView()')
            wait('return document.querySelector(".robot-cat-story").hasAttribute("data-motion")')
            for key,p in [(1,.155),(2,.29),(3,.44),(4,.62),(6,.85),(7,.95)]:
                execute('const s=document.querySelector(".story-scene"), stage=document.querySelector(".story-stage");scrollTo(0,scrollY+s.getBoundingClientRect().top+arguments[0]*(s.offsetHeight-stage.offsetHeight))',p)
                wait('return Number(document.querySelector("canvas").dataset.frame) === arguments[0]',74 if key==6 else key*12)
                screenshot(f'K{key}-{width}.png')
        else:
            for key in [1,2,3,4,6,7]:
                execute('document.querySelectorAll("[data-story-key]")[arguments[0]].scrollIntoView()',key)
                wait('const i=document.querySelectorAll("[data-story-key]")[arguments[0]].querySelector("img");return i.complete && i.naturalWidth>0',key)
            screenshot(f'flow-{width}.png')
        row=execute('return {width:innerWidth,height:innerHeight,motion:document.querySelector(".robot-cat-story").hasAttribute("data-motion"),overflow:document.documentElement.scrollWidth>innerWidth,headings:document.querySelectorAll("h1").length,peakBytes:document.querySelector(".robot-cat-story").dataset.peakBytes,peakRequests:document.querySelector(".robot-cat-story").dataset.peakRequests}')
        assert row['width']==width and row['height']==height,row
        assert not row['overflow'] and row['headings']==1,row
        if args.reduced or width<1024: assert not row['motion'],row
        execute('document.getElementById("robot-paint").scrollIntoView()')
        screenshot(f'K8-{width}.png')
        row['viewportMethod']='iframe' if width<500 else 'native window'
        report['checks'].append(row)
        print(row,flush=True)
    if args.zoom_only:
        assert args.browser=='firefox'
        request(session+'/window/rect',{'width':1440,'height':1000})
        request(session+'/url',{'url':args.url})
        inner=execute('return [innerWidth,innerHeight]')
        request(session+'/window/rect',{'width':1440+1440-inner[0],'height':1000+900-inner[1]})
        request(session+'/moz/context',{'context':'chrome'})
        execute('ZoomManager.zoom = 2')
        request(session+'/moz/context',{'context':'content'})
        wait('return innerWidth===720 && !document.querySelector(".robot-cat-story").hasAttribute("data-motion")')
        row=execute('return {name:"native zoom",zoom:2,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,motion:document.querySelector(".robot-cat-story").hasAttribute("data-motion"),overflow:document.documentElement.scrollWidth>innerWidth}')
        assert row['height']==450 and not row['overflow'],row
        execute('document.querySelectorAll("[data-story-key]")[6].scrollIntoView()')
        wait('const i=document.querySelectorAll("[data-story-key]")[6].querySelector("img");return i.complete && i.naturalWidth>0')
        screenshot('zoom-200.png')
        report['checks'].append(row)
        print(row,flush=True)
finally:
    (OUT / ('zoom-200.json' if args.zoom_only else 'reduced.json' if args.reduced else 'static.json' if args.static_only else 'matrix.json')).write_text(json.dumps(report,indent=2)+'\n')
    request(session, method='DELETE')
