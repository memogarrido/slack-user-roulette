export interface Wheel{
    workflowId:string,
    stepId:string,
    resultSize:number;
    users:{[key: string]: User}
}

export interface User{
    count:0;
    userId:string
}
