"""Local Firefox acceptance probe for the playground (no publishing or browser profile changes)."""
from pathlib import Path
import argparse, base64, json, time, urllib.error, urllib.request
parser=argparse.ArgumentParser()
parser.add_argument("--normal-motion", action="store_true")
parser.add_argument("--no-js", action="store_true")
parser.add_argument("--zoom-only", action="store_true")
parser.add_argument("--initial-failure", action="store_true")
args=parser.parse_args()

ENDPOINT = 'http://127.0.0.1:4447' if args.zoom_only else 'http://127.0.0.1:4446'
URL = 'http://localhost:4330/models/robot-cat/'
OUT = Path('docs/design/robot-cat-playground/acceptance/firefox')
OUT.mkdir(parents=True, exist_ok=True)

def request(path, payload=None, method=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(ENDPOINT + path, data=data, method=method or ('POST' if data else 'GET'), headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=35) as response: result = json.load(response)['value']
    except urllib.error.HTTPError as error: raise RuntimeError(error.read().decode()) from error
    if isinstance(result, dict) and 'error' in result: raise RuntimeError(result)
    return result

def execute(script, *args): return request(session + '/execute/sync', {'script':script, 'args':list(args)})
def wait(script, *args):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        result = execute(script, *args)
        if result: return result
        time.sleep(.08)
    raise RuntimeError('Timed out: ' + script)
def screenshot(name): (OUT / name).write_bytes(base64.b64decode(request(session+'/screenshot')))

report = []
cap = {'browserName':'firefox', 'moz:firefoxOptions':{'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox', 'args':['-headless'], 'prefs':{'ui.prefersReducedMotion':0 if args.normal_motion else 1, 'javascript.enabled':not args.no_js}}}
created = request('/session', {'capabilities':{'alwaysMatch':cap}})
session = '/session/' + created['sessionId']
try:
    for width,height in ([(1440,900)] if args.zoom_only or args.initial_failure else [(390,844),(768,1024),(1440,900),(1920,1080)]):
        request(session+'/frame', {'id':None})
        outer_width=max(500,width)
        request(session+'/window/rect', {'width':outer_width,'height':height})
        request(session+'/url', {'url':URL})
        inner=execute('return [innerWidth,innerHeight]')
        request(session+'/window/rect', {'width':outer_width + outer_width-inner[0], 'height':height + height-inner[1]})
        if width < 500:
            frame=execute('document.body.replaceChildren();document.body.style.margin="0";const f=document.createElement("iframe");f.style.cssText="display:block;border:0";f.width=arguments[0];f.height=arguments[1];f.src=arguments[2];document.body.appendChild(f);return f',width,height,URL)
            request(session+'/frame', {'id':frame})
        if args.zoom_only:
            request(session+'/moz/context', {'context':'chrome'})
            execute('ZoomManager.zoom=2')
            request(session+'/moz/context', {'context':'content'})
        wait('return document.querySelector("#robot-playground") && document.readyState === "complete"')
        if args.initial_failure:
            execute('window.__initialFailure=false;window.__initialFetch=window.fetch;window.fetch=(url,opts)=>String(url).includes("cat-robot-tail.webp")?(window.__initialFailure=true,Promise.reject(new Error("injected initial failure"))):window.__initialFetch(url,opts)')
        execute('document.querySelector("#robot-playground").scrollIntoView()')
        if args.initial_failure:
            wait('return window.__initialFailure'); time.sleep(.2)
            row=execute('return {appHidden:document.querySelector(".playground-app").hidden,fallbackVisible:!document.querySelector(".playground-fallback").hidden,retryVisible:!document.querySelector("[data-initial-error]").hidden,thumbLoaded:getComputedStyle(document.querySelector(".playground-head-thumb")).backgroundImage.includes("data:image/webp"),cartLoaded:document.querySelector(".playground-cart img").naturalWidth>0}')
            assert all(row.values()),row
            screenshot('initial-failure.png')
            execute('window.__initialFailure=false;document.querySelector("[data-initial-retry]").focus();document.querySelector("[data-initial-retry]").click()')
            wait('return window.__initialFailure && !document.querySelector("[data-initial-retry]").disabled')
            row['failedRetryRestoresFocus']=execute('return document.activeElement===document.querySelector("[data-initial-retry]")')
            assert row['failedRetryRestoresFocus'],row
            execute('window.fetch=window.__initialFetch;document.querySelector("[data-initial-retry]").click()')
            wait('return !document.querySelector(".playground-app").hidden')
            row['retryRestoresFocus']=execute('return document.activeElement===document.querySelector("[data-stage]")')
            assert row['retryRestoresFocus'],row
            report.append(row);print(row,flush=True);continue
        if args.no_js:
            wait('const i=document.querySelector(".playground-cart img");return i.complete && i.naturalWidth>0')
            row=execute('return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,fallbackVisible:!document.querySelector(".playground-fallback").hidden,appHidden:document.querySelector(".playground-app").hidden,pauseHidden:document.querySelector("#background-pause").hidden && getComputedStyle(document.querySelector("#background-pause")).display==="none",galleryLinks:document.querySelectorAll(".gallery a[href]").length,thumbLoaded:getComputedStyle(document.querySelector(".playground-head-thumb")).backgroundImage.includes("data:image/webp"),cartLoaded:document.querySelector(".playground-cart img").naturalWidth>0}')
            assert row['width']==width and row['height']==height and not row['overflow'] and row['fallbackVisible'] and row['appHidden'] and row['pauseHidden'] and row['galleryLinks']>0 and row['thumbLoaded'] and row['cartLoaded'],row
            screenshot(f'no-js-{width}.png'); report.append(row); print(row,flush=True); continue
        wait('return !document.querySelector(".playground-app").hidden')
        row=execute('return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,stage:document.querySelector("[data-stage]").getBoundingClientRect().toJSON(),appHidden:document.querySelector(".playground-app").hidden,description:document.querySelector("[data-stage]").getAttribute("aria-label")}')
        expected=(width//2,height//2) if args.zoom_only else (width,height)
        assert (row['width'],row['height'])==expected and not row['overflow'],row
        if args.zoom_only: assert execute('return getComputedStyle(document.querySelector(".playground-layout")).display === "flex"')
        screenshot('zoom-200.png' if args.zoom_only else f'{"normal" if args.normal_motion else "reduced"}-initial-{width}.png')
        execute('document.querySelector("[data-select=head][data-value=duck]").click()')
        wait('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
        execute('document.querySelector("[data-select=body][data-value=plain]").click()')
        wait('return document.querySelector("[data-select=body][data-value=plain]").getAttribute("aria-pressed")==="true"')
        execute('document.querySelector("[data-action=editor]").click();document.querySelector("[data-template=star]").click()')
        assert execute('return !document.querySelector(".playground-editor").hidden')
        screenshot(f'{"normal" if args.normal_motion else "reduced"}-editor-{width}.png')
        execute('document.querySelector("[data-action=done]").click();document.querySelector("[data-select=mode][data-value=cart]").click()')
        wait('return document.querySelector("[data-select=mode][data-value=cart]").getAttribute("aria-pressed")==="true"')
        assert execute('return document.querySelector("[data-body-options]").hidden && document.querySelector("[data-action=editor]").hidden')
        execute('document.querySelector("[data-roll="+JSON.stringify("1")+"]").click()')
        if args.normal_motion:
            wait(r'return /translateX\((?!0%)/.test(document.querySelector("[data-model]").style.transform)')
            execute('document.querySelectorAll("[data-roll]")[2].click()')
        else:
            assert execute('return document.querySelector("[data-model]").style.transform.includes("4.5%")')
        screenshot(f'{"normal" if args.normal_motion else "reduced"}-cart-{width}.png')
        execute('document.querySelector("[data-action=explode]").click()')
        wait('return document.querySelector("[data-action=explode]").textContent.includes("обратно")')
        assert execute('return document.querySelector(".playground-roll").hidden')
        execute('document.querySelector("[data-select=mode][data-value=robot]").click()')
        wait('return document.querySelector("[data-select=mode][data-value=robot]").getAttribute("aria-pressed")==="true"')
        assert execute('return document.querySelector("[data-select=body][data-value=plain]").getAttribute("aria-pressed")==="true"')
        execute('document.querySelector("[data-action=editor]").click()')
        row['drawingSurvived']=execute('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
        assert row['drawingSurvived']
        execute('document.querySelector("[data-action=clear]").click();document.querySelector("[data-action=undo]").click()')
        assert execute('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
        execute('document.querySelector("[data-action=done]").click()')
        row['peakDecodedBytes']=execute('return Number(document.querySelector(".playground-app").dataset.peakDecodedBytes)')
        report.append(row); print(row, flush=True)
except Exception:
    try:
        print('DEBUG', execute('return {error:document.querySelector(".playground-error")?.hidden, errorText:document.querySelector(".playground-error")?.textContent, aria:document.querySelector("[data-stage]")?.getAttribute("aria-label"), head:document.querySelector("[data-select=head][data-value=duck]")?.getAttribute("aria-pressed"), body:document.querySelector("[data-select=body][data-value=plain]")?.getAttribute("aria-pressed"), bytes:document.querySelector(".playground-app")?.dataset.decodedBytes, peak:document.querySelector(".playground-app")?.dataset.peakDecodedBytes}'), flush=True)
        screenshot('failure.png')
    except Exception: pass
    raise
finally:
    (OUT/('initial-failure.json' if args.initial_failure else 'zoom-200.json' if args.zoom_only else 'no-js.json' if args.no_js else 'normal-motion.json' if args.normal_motion else 'reduced-motion.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    request(session, method='DELETE')
