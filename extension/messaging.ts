export type ExtensionMessage={type?:string;token?:string};
export type MessageActions={start:()=>Promise<unknown>;cancel:()=>unknown;open:(token:string)=>Promise<unknown>};
export function handleMessage(message:unknown,actions:MessageActions,respond:(value:unknown)=>void){
 const input=message as ExtensionMessage;
 if(input.type==='START_CAPTURE'){actions.start().then(respond,error=>respond({ok:false,error:error instanceof Error?error.message:'Analysis failed'}));return true}
 if(input.type==='CANCEL_CAPTURE'){actions.cancel();respond({ok:true});return false}
 if(input.type==='OPEN_BIDLENS'&&input.token){actions.open(input.token).then(()=>respond({ok:true}),error=>respond({ok:false,error:String(error)}));return true}
 return false;
}
