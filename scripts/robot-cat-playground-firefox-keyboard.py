"""Keyboard-only Firefox acceptance probe for the playground."""
from pathlib import Path
import base64,json,time,urllib.request,urllib.error
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
def key(code):
    req(session+'/actions',{'actions':[{'type':'key','id':'keyboard','actions':[{'type':'keyDown','value':code},{'type':'keyUp','value':code}]}]})
def focus(selector):
    js('document.querySelector(arguments[0]).focus()',selector)
    assert js('return document.activeElement===document.querySelector(arguments[0])',selector),selector
def activate(selector):focus(selector);key('\ue00d')
cap={'browserName':'firefox','moz:firefoxOptions':{'binary':'/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox','args':['-headless'],'prefs':{'ui.prefersReducedMotion':1}}}
created=req('/session',{'capabilities':{'alwaysMatch':cap}});session='/session/'+created['sessionId'];report={}
try:
    req(session+'/window/rect',{'width':1440,'height':1000});req(session+'/url',{'url':URL})
    focus('a[href="#robot-playground"]');key('\ue007')
    wait('return !document.querySelector(".playground-app").hidden')
    activate('[data-select="head"][data-value="dog"]')
    wait('return document.querySelector("[data-select=head][data-value=dog]").getAttribute("aria-pressed")==="true"')
    activate('[data-select="body"][data-value="plain"]')
    wait('return document.querySelector("[data-select=body][data-value=plain]").getAttribute("aria-pressed")==="true"')
    activate('[data-action="explode"]')
    wait('return document.querySelector("[data-action=explode]").textContent.includes("обратно")')
    activate('[data-action="explode"]')
    wait('return document.querySelector("[data-action=explode]").textContent.includes("соединяется")')
    report['headBodyConnections']=True
    activate('[data-select="mode"][data-value="cart"]')
    wait('return document.querySelector("[data-select=mode][data-value=cart]").getAttribute("aria-pressed")==="true"')
    focus('[data-stage]'); key('\ue014')
    assert js('return document.querySelector("[data-model]").style.transform.includes("4.5%")')
    activate('[data-roll="-1"]')
    assert js('return document.querySelector("[data-model]").style.transform.includes("0%")')
    activate('[data-roll="1"]'); activate('[data-roll="0"]')
    report['cartAndFocusedArrows']=True
    activate('[data-select="mode"][data-value="robot"]')
    wait('return document.querySelector("[data-select=mode][data-value=robot]").getAttribute("aria-pressed")==="true"')
    assert js('return document.querySelector("[data-select=body][data-value=plain]").getAttribute("aria-pressed")==="true"')
    activate('[data-action="editor"]')
    assert js('return document.activeElement===document.querySelector("[data-action=done]")')
    activate('[data-template="heart"]')
    assert js('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
    activate('[data-action="clear"]'); activate('[data-action="undo"]')
    assert js('const c=document.querySelector("[data-editor-canvas]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0)')
    # Last editor button wraps Tab to the first, and Escape restores the opener.
    focus('[data-action="done"]'); key('\ue004')
    assert js('return document.activeElement===document.querySelector("[data-color]")')
    key('\ue00c')
    assert js('return document.querySelector(".playground-editor").hidden && document.activeElement===document.querySelector("[data-action=editor]")')
    report['templateUndoFocusTrapAndEscape']=True
    OUT=Path('docs/design/robot-cat-playground/acceptance/firefox');OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'keyboard.png').write_bytes(base64.b64decode(req(session+'/screenshot')))
    print(json.dumps(report,ensure_ascii=False),flush=True)
finally:
    OUT=Path('docs/design/robot-cat-playground/acceptance/firefox');OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'keyboard.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    req(session,method='DELETE')
