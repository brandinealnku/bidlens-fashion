import{DEFAULT_SETTINGS,type CapturePayload,type Settings}from'./types';
export async function settings():Promise<Settings>{const x=await chrome.storage.local.get('settings');return{...DEFAULT_SETTINGS,...(x.settings as Partial<Settings>||{})}}
export async function saveCapture(payload:CapturePayload){const token=`capture_${crypto.randomUUID()}`;await chrome.storage.local.set({[token]:payload,lastCaptureToken:token});return token}
