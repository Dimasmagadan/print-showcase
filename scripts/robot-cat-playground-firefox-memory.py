"""Sample Firefox's anonymized image cache beside the page's owned-frame counter.

The playground animation is held after decoding so the peak frame set stays live
while Firefox collects its report. This is a conservative snapshot, not a profiler
trace of every browser allocation.
"""
import json,time,urllib.request,urllib.error
from pathlib import Path
END='http://127.0.0.1:4447'; URL='http://localhost:4330/models/robot-cat/'
def req(path,payload=None,method=None):
    data=None if payload is None else json.dumps(payload).encode()
    request=urllib.request.Request(END+path,data=data,method=method or ('POST' if data else 'GET'),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=60) as r:value=json.load(r)['value']
    except urllib.error.HTTPError as error:raise RuntimeError(error.read().decode()) from error
    if isinstance(value,dict) and 'error' in value:raise RuntimeError(value)
    return value
def js(code,*args):return req(session+'/execute/sync',{'script':code,'args':list(args)})
def wait(code):
    end=time.monotonic()+20
    while time.monotonic()<end:
        value=js(code)
        if value:return value
        time.sleep(.08)
    raise RuntimeError('Timeout: '+code)
def measure():
    owned=js('const d=document.querySelector(".robot-cat-story").dataset;return {current:Number(d.combinedAccountedBytes||0),peak:Number(d.combinedPeakBytes||0)}')
    req(session+'/moz/context',{'context':'chrome'})
    result=req(session+'/execute/async',{'script':'''const done=arguments[arguments.length-1], out=[];try {const mgr=Cc["@mozilla.org/memory-reporter-manager;1"].getService(Ci.nsIMemoryReporterManager);mgr.getReports((process,path,kind,units,amount)=>{if(process.includes("Isolated Web Content") && path==="imagelib-surface-cache-estimated-total" && units===0)out.push(amount)},null,()=>done(out),null,true)}catch(e){done({error:String(e)})}''','args':[]})
    req(session+'/moz/context',{'context':'content'})
    if not isinstance(result,list) or not result:raise RuntimeError('Firefox image-cache reporter unavailable: '+repr(result))
    image_cache=sum(result)
    return {'owned':owned,'imageCacheBytes':image_cache,'conservativeSnapshotBytes':owned['current']+image_cache}
cap={'browserName':'firefox','moz:firefoxOptions':{'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox','args':['-headless'],'prefs':{'ui.prefersReducedMotion':0}}}
created=req('/session',{'capabilities':{'alwaysMatch':cap}});session='/session/'+created['sessionId'];report={}
try:
    req(session+'/window/rect',{'width':1440,'height':1000});req(session+'/url',{'url':URL})
    js('document.querySelector(".story-scene").scrollIntoView()');wait('return document.querySelector(".robot-cat-story").hasAttribute("data-motion")')
    js('const s=document.querySelector(".story-scene"),t=document.querySelector(".story-stage");scrollTo(0,scrollY+s.getBoundingClientRect().top+.44*(s.offsetHeight-t.offsetHeight))')
    wait('return Number(document.querySelector(".robot-cat-story").dataset.storyAccountedBytes)>=44800000')
    report['story']=measure()
    js('document.querySelector("#robot-playground").scrollIntoView()');wait('return !document.querySelector(".playground-app").hidden')
    # Keep the first transition frame queued while all required bitmaps are live.
    js('window.__savedRaf=window.requestAnimationFrame;window.requestAnimationFrame=()=>123456')
    js('document.querySelector("[data-select=mode][data-value=cart]").click()')
    wait('return Number(document.querySelector(".playground-app").dataset.decodedBytes)===29491200')
    report['playgroundTransition']=measure()
    for sample in report.values():assert sample['conservativeSnapshotBytes']<64*1024*1024,sample
    print(json.dumps(report,ensure_ascii=False),flush=True)
finally:
    path=Path('docs/design/robot-cat-playground/acceptance/firefox');path.mkdir(parents=True,exist_ok=True)
    (path/'memory-reporter.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    req(session,method='DELETE')
