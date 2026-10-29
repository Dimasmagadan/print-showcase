"""Verify all twelve selected assemblies on the live page in Firefox."""
from pathlib import Path
import json,time,urllib.request,urllib.error
ENDPOINT='http://127.0.0.1:4446'; URL='http://localhost:4330/models/robot-cat/'
def req(path,payload=None,method=None):
    data=None if payload is None else json.dumps(payload).encode()
    request=urllib.request.Request(ENDPOINT+path,data=data,method=method or ('POST' if data else 'GET'),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=30) as response:value=json.load(response)['value']
    except urllib.error.HTTPError as error:raise RuntimeError(error.read().decode()) from error
    if isinstance(value,dict) and 'error' in value:raise RuntimeError(value)
    return value
def js(code,*args):return req(session+'/execute/sync',{'script':code,'args':list(args)})
def wait(code,*args):
    end=time.monotonic()+15
    while time.monotonic()<end:
        result=js(code,*args)
        if result:return result
        time.sleep(.05)
    raise RuntimeError('Timed out: '+code)
def choose(kind,value):
    js('document.querySelector(`[data-select="${arguments[0]}"][data-value="${arguments[1]}"]`).click()',kind,value)
    wait('return document.querySelector(`[data-select="${arguments[0]}"][data-value="${arguments[1]}"]`).getAttribute("aria-pressed")==="true"',kind,value)
cap={'browserName':'firefox','moz:firefoxOptions':{'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox','args':['-headless'],'prefs':{'ui.prefersReducedMotion':1}}}
created=req('/session',{'capabilities':{'alwaysMatch':cap}}); session='/session/'+created['sessionId']; report=[]
try:
    req(session+'/window/rect',{'width':1440,'height':1000}); req(session+'/url',{'url':URL})
    js('document.querySelector("#robot-playground").scrollIntoView()'); wait('return !document.querySelector(".playground-app").hidden')
    for head in ['cat','bunny','duck','dog']:
        choose('head',head)
        for mode,body in [('robot','tail'),('robot','plain'),('cart',None)]:
            choose('mode',mode)
            if body:choose('body',body)
            row=js('''const c=document.querySelector('[data-image]'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<d.length;i+=17)h=Math.imul(h^d[i],16777619);return {label:document.querySelector('[data-stage]').getAttribute('aria-label'),hash:h>>>0,bodyHidden:document.querySelector('[data-body-options]').hidden}''')
            row.update(head=head,mode=mode,body=body); assert row['bodyHidden']==(mode=='cart'),row
            assert ('тележке' in row['label'])==(mode=='cart'),row
            if body:assert ('без хвоста' in row['label'])==(body=='plain'),row
            report.append(row)
    assert len({row['hash'] for row in report})==12,report
    print(json.dumps(report,ensure_ascii=False),flush=True)
finally:
    out=Path('docs/design/robot-cat-playground/acceptance/firefox');out.mkdir(parents=True,exist_ok=True)
    (out/'combinations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    req(session,method='DELETE')
