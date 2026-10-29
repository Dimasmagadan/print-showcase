"""Firefox native-input and failure/reverse-scroll acceptance probe."""
from pathlib import Path
import argparse, base64, io, json, time, urllib.request, urllib.error
parser=argparse.ArgumentParser()
parser.add_argument("--touch-enabled", action="store_true")
args=parser.parse_args()
from PIL import Image, ImageChops
ENDPOINT='http://127.0.0.1:4446'; URL='http://localhost:4330/models/robot-cat/'
OUT=Path('docs/design/robot-cat-playground/acceptance/firefox'); OUT.mkdir(parents=True,exist_ok=True)
def req(path,payload=None,method=None):
    data=None if payload is None else json.dumps(payload).encode()
    request=urllib.request.Request(ENDPOINT+path,data=data,method=method or ('POST' if data else 'GET'),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=40) as response: value=json.load(response)['value']
    except urllib.error.HTTPError as error: raise RuntimeError(error.read().decode()) from error
    if isinstance(value,dict) and 'error' in value: raise RuntimeError(value)
    return value
def js(code,*args): return req(session+'/execute/sync',{'script':code,'args':list(args)})
def wait(code,*args):
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
        value=js(code,*args)
        if value:return value
        time.sleep(.08)
    raise RuntimeError('Timed out: '+code)
def click(selector):
    element=req(session+'/element',{'using':'css selector','value':selector})
    req(session+'/element/'+element['element-6066-11e4-a52e-4f735466cecf']+'/click',{})
def snap(name): (OUT/name).write_bytes(base64.b64decode(req(session+'/screenshot')))
def mouse_drag(x,y,dx,dy):
    req(session+'/actions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'x':x,'y':y,'origin':'viewport'},{'type':'pointerDown','button':0},{'type':'pointerMove','duration':300,'x':x+dx,'y':y+dy,'origin':'viewport'},{'type':'pointerUp','button':0}]}]})
    req(session+'/actions',method='DELETE')
def touch_drag(x,y,dx,dy):
    req(session+'/actions',{'actions':[{'type':'pointer','id':'touch','parameters':{'pointerType':'touch'},'actions':[{'type':'pointerMove','duration':0,'x':x,'y':y,'origin':'viewport'},{'type':'pointerDown','button':0},{'type':'pointerMove','duration':300,'x':x+dx,'y':y+dy,'origin':'viewport'},{'type':'pointerUp','button':0}]}]})
    req(session+'/actions',method='DELETE')
def key(code): req(session+'/actions',{'actions':[{'type':'key','id':'keyboard','actions':[{'type':'keyDown','value':code},{'type':'keyUp','value':code}]}]})
cap={'browserName':'firefox','moz:firefoxOptions':{'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox','args':['-headless'],'prefs':{'ui.prefersReducedMotion':0, 'dom.w3c_touch_events.enabled':1 if args.touch_enabled else 2, 'apz.allow_zooming':bool(args.touch_enabled)}}}
created=req('/session',{'capabilities':{'alwaysMatch':cap}}); session='/session/'+created['sessionId']; report={}
try:
    req(session+'/window/rect',{'width':1440,'height':1000}); req(session+'/url',{'url':URL})
    inner=js('return [innerWidth,innerHeight]'); req(session+'/window/rect',{'width':1440+1440-inner[0],'height':1000+900-inner[1]})
    js('performance.setResourceTimingBufferSize(5000)')
    wait('return !document.querySelector("#background-pause").hidden')
    assert js('return document.querySelector(".model-head").contains(document.querySelector("#background-pause")) && getComputedStyle(document.querySelector("#background-pause")).position === "static"')
    click('#background-pause')
    assert js('return document.querySelector("#background-pause").getAttribute("aria-pressed")==="true" && [...document.querySelectorAll(".cat-background")].every(x=>x.classList.contains("is-paused"))')
    click('#background-pause'); report['backgroundPause']=True
    # Force one real media failure before the section is first approached.
    js('window.__nativeFetch=window.fetch; window.fetch=(url,opts)=>String(url).includes("duck-robot-tail.webp")?Promise.reject(new Error("injected failure")):window.__nativeFetch(url,opts)')
    js('document.querySelector("#robot-playground").scrollIntoView()')
    wait('return !document.querySelector(".playground-app").hidden')
    click('[data-select="head"][data-value="duck"]')
    wait('return !document.querySelector(".playground-error").hidden')
    assert js('return document.querySelector("[data-select=head][data-value=cat]").getAttribute("aria-pressed")==="true"')
    js('window.fetch=window.__nativeFetch'); click('[data-retry]')
    wait('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    report['mediaFailureAndRetry']=True
    time.sleep(.8)
    js('''window.fetch=(url,opts)=>String(url).includes("dog-robot-tail.webp")?Promise.resolve(new Response(new Blob(["not an image"],{type:"image/webp"}),{status:200})):window.__nativeFetch(url,opts)''')
    click('[data-select="head"][data-value="dog"]');wait('return !document.querySelector(".playground-error").hidden')
    assert js('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    js('window.fetch=window.__nativeFetch');click('[data-retry]')
    wait('return document.querySelector("[data-select=head][data-value=dog]").getAttribute("aria-pressed")==="true"')
    click('[data-select="head"][data-value="duck"]')
    wait('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    report['decodeFailureAndRetry']=True
    time.sleep(.8)
    js('''window.fetch=(url,opts)=>String(url).includes("dog-robot-tail.webp")?new Promise((resolve,reject)=>{const timer=setTimeout(()=>window.__nativeFetch(url,opts).then(resolve,reject),1200);opts.signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))},{once:true})}):window.__nativeFetch(url,opts)''')
    click('[data-select="head"][data-value="dog"]')
    assert js('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    click('[data-select="head"][data-value="bunny"]')
    wait('return document.querySelector("[data-select=head][data-value=bunny]").getAttribute("aria-pressed")==="true"')
    js('window.fetch=window.__nativeFetch'); click('[data-select="head"][data-value="duck"]')
    wait('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    report['slowRequestLatestChoice']=True
    click('[data-select="mode"][data-value="cart"]')
    wait('return document.querySelector("[data-select=mode][data-value=cart]").getAttribute("aria-pressed")==="true"'); time.sleep(.8)
    js('document.querySelector("[data-stage]").scrollIntoView({block:"center"})')
    rect=js('let r=document.querySelector("[data-stage]").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}')
    x=int(rect['x']+rect['w']/2); y=int(rect['y']+rect['h']/2)
    before=js('return document.querySelector("[data-model]").style.transform')
    mouse_drag(x,y,60,0); time.sleep(.15)
    after=js('return document.querySelector("[data-model]").style.transform')
    assert before!=after,(before,after); click('[data-roll="0"]')
    report['nativeHorizontalDrag']=[before,after]
    touch_before=js('return document.querySelector("[data-model]").style.transform')
    touch_drag(x,y,60,0); time.sleep(.15)
    touch_after=js('return document.querySelector("[data-model]").style.transform')
    assert touch_before!=touch_after,(touch_before,touch_after)
    click('[data-roll="0"]'); report['horizontalTouchDrag']=[touch_before,touch_after]
    js('window.__pointerLog=[];const s=document.querySelector("[data-stage]");for(const t of ["pointerdown","pointermove","pointercancel","pointerup"])s.addEventListener(t,e=>window.__pointerLog.push({type:e.type,pointer:e.pointerType}));')
    scroll_before=js('return scrollY'); cart_before=js('return document.querySelector("[data-model]").style.transform'); touch_drag(x,y,0,-140); time.sleep(.5)
    cart_after=js('return document.querySelector("[data-model]").style.transform'); assert cart_before==cart_after,(cart_before,cart_after)
    report['touchProbe']={'verticalCartStationary':True,'scrollBefore':scroll_before,'scrollAfter':js('return scrollY'),'events':js('return window.__pointerLog'),'touchAction':js('return getComputedStyle(document.querySelector("[data-stage]")).touchAction')}
    js('const box=document.createElement("div");box.id="touch-baseline";box.style.cssText="position:fixed;left:0;top:0;width:300px;height:300px;overflow:auto;touch-action:pan-y;z-index:9999";const child=document.createElement("div");child.style.height="1200px";box.append(child);document.body.append(box)')
    touch_drag(150,220,0,-140); time.sleep(.4)
    report['touchProbe']['baselineScroll']=js('const b=document.querySelector("#touch-baseline"),v=b.scrollTop;b.remove();return v')
    js('document.querySelector("[data-stage]").focus()'); key('\ue014')
    wait('return !document.querySelector("[data-model]").style.transform.includes("translateX(0%)")')
    click('[data-roll="0"]'); report['focusedArrowKey']=True
    js('window.__visibilityLog=[];document.addEventListener("visibilitychange",()=>window.__visibilityLog.push(document.visibilityState));document.querySelectorAll("[data-roll]")[1].click()')
    first=req(session+'/window'); second=req(session+'/window/new',{'type':'tab'}); req(session+'/window',{'handle':second['handle']}); time.sleep(.4)
    req(session+'/window',{'handle':first}); time.sleep(.2)
    after_return=js('return document.querySelector("[data-model]").style.transform'); time.sleep(.6)
    report['backgroundTab']={'events':js('return window.__visibilityLog'),'stationaryAfterReturn':after_return==js('return document.querySelector("[data-model]").style.transform')}
    assert 'hidden' in report['backgroundTab']['events'] and report['backgroundTab']['stationaryAfterReturn'],report['backgroundTab']
    click('[data-select="mode"][data-value="robot"]')
    wait('return document.querySelector("[data-select=mode][data-value=robot]").getAttribute("aria-pressed")==="true"'); time.sleep(.8)
    click('[data-action="editor"]')
    assert js('return document.activeElement===document.querySelector("[data-action=done]")')
    rect=js('let r=document.querySelector("[data-editor-canvas]").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}')
    mouse_drag(int(rect['x']+rect['w']*.3),int(rect['y']+rect['h']*.3),60,40)
    assert js('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
    snap('native-drawing.png'); click('[data-action="done"]')
    assert js('return document.activeElement===document.querySelector("[data-action=editor]")')
    report['nativeDrawingAndFocus']=True
    js('document.querySelector("[data-stage]").scrollIntoView({block:"center"})')
    art=js('''const c=document.querySelector("[data-art]"),p=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let xs=[],ys=[];for(let i=3;i<p.length;i+=4)if(p[i]){let n=(i-3)/4;xs.push(n%c.width);ys.push(Math.floor(n/c.width))}return {pixels:xs.length,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],blend:getComputedStyle(c).mixBlendMode,rect:c.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]}''')
    assert art['pixels']>0 and art['blend']=='normal' and 361<=art['bounds'][0]<=art['bounds'][2]<420 and 455<=art['bounds'][1]<=art['bounds'][3]<520,art
    js('document.querySelectorAll(".cat-background").forEach(x=>x.classList.add("is-paused"))')
    before=base64.b64decode(req(session+'/screenshot')); (OUT/'native-body-drawing.png').write_bytes(before)
    js('document.querySelector("[data-art]").style.visibility="hidden"')
    after=base64.b64decode(req(session+'/screenshot')); js('document.querySelector("[data-art]").style.visibility=""')
    first=Image.open(io.BytesIO(before)).convert('RGB'); second=Image.open(io.BytesIO(after)).convert('RGB')
    sx=first.width/art['viewport'][0]; sy=first.height/art['viewport'][1]; r=art['rect']; b=art['bounds']
    left=int((r['left']+b[0]*r['width']/800-3)*sx); top=int((r['top']+b[1]*r['height']/800-3)*sy)
    right=int((r['left']+(b[2]+1)*r['width']/800+3)*sx); bottom=int((r['top']+(b[3]+1)*r['height']/800+3)*sy)
    diff=ImageChops.difference(first.crop((left,top,right,bottom)),second.crop((left,top,right,bottom)))
    changed=sum(1 for px in diff.getdata() if max(px)>12)
    assert changed>=5,{'changedPixels':changed,'bounds':art['bounds']}
    report['visibleProjectedDrawing']={'changedPixels':changed,'bounds':art['bounds'],'blend':art['blend']}
    js('document.querySelectorAll(".cat-background").forEach(x=>x.classList.remove("is-paused"))')
    js('document.querySelector("#robot-key-4").scrollIntoView();scrollBy(0,-700)'); time.sleep(.5)
    print('handoff', js('return {bytes:document.querySelector(".playground-app").dataset.decodedBytes,top:document.querySelector("#robot-playground").getBoundingClientRect().top,scroll:scrollY,story:document.querySelector(".robot-cat-story").dataset.motion}'),flush=True)
    wait('return Number(document.querySelector(".playground-app").dataset.decodedBytes)===0')
    for progress, frame in [(.62,48),(.95,84),(.29,24)]:
        js('const s=document.querySelector(".story-scene"),t=document.querySelector(".story-stage");scrollTo(0,scrollY+s.getBoundingClientRect().top+arguments[0]*(s.offsetHeight-t.offsetHeight))',progress)
        wait('return Number(document.querySelector(".story-space>canvas").dataset.frame)===arguments[0]',frame)
    snap('story-reverse-K2.png'); report['storyReverseFrames']=[48,84,24]
    js('document.querySelector("#robot-playground").scrollIntoView()')
    wait('return Number(document.querySelector(".playground-app").dataset.decodedBytes)>0')
    assert js('return document.querySelector("[data-select=head][data-value=duck]").getAttribute("aria-pressed")==="true"')
    click('[data-action="editor"]')
    assert js('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
    click('[data-action="done"]'); report['reverseScrollAndDrawing']=True
    req(session+'/window/rect',{'width':800,'height':800}); time.sleep(.2)
    assert not js('return document.documentElement.scrollWidth>innerWidth')
    report['resizeNoOverflow']=True
    report['ownedDecodedMemory']=js('const d=document.querySelector(".robot-cat-story").dataset;return {peak:Number(d.combinedPeakBytes),story:Number(d.storyAccountedBytes),playground:Number(d.playgroundAccountedBytes)}')
    assert report['ownedDecodedMemory']['peak'] <= 64*1024*1024,report['ownedDecodedMemory']
    report['mediaRequestPeak']=js('''const entries=performance.getEntriesByType("resource").filter(e=>e.name.includes("/media/robot-cat-playground/")||e.name.includes("/media/robot-cat-story/v2/"));let events=[];for(const e of entries)if(e.responseEnd>e.startTime){events.push([e.startTime,1,e.name],[e.responseEnd,-1,e.name])}events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=new Map(),peak=0,at=[];for(const [,d,name] of events){if(d>0)active.set(name,(active.get(name)||0)+1);else if(active.get(name)===1)active.delete(name);else active.set(name,(active.get(name)||1)-1);const n=[...active.values()].reduce((a,b)=>a+b,0);if(n>peak){peak=n;at=[...active.keys()].map(x=>x.split('/').slice(-2).join('/'))}}return {peak,count:entries.length,at}''')
    assert report['mediaRequestPeak']['peak'] <= 3, report['mediaRequestPeak']
    print(json.dumps(report,ensure_ascii=False),flush=True)
finally:
    (OUT/('interactions-touch.json' if args.touch_enabled else 'interactions.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    req(session,method='DELETE')
