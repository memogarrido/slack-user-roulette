export interface Wheel {
  workflowId: string;
  stepId: string;
  resultSize: number;
  numberOfResults: number;
  groupCount: number;
  groups: { [key: string]: Group };
}

export interface User {
  count: number;
  groupId:string;
  userId: string;
}

export interface Group {
  id: string;
  availableUsersCount: number;
  usersWithMeetings: number;
  users: { [key: string]: User };
}
