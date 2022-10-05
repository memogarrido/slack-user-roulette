import * as admin from "firebase-admin";
import {database} from "firebase-admin";
import {Group, User, Wheel} from "../../models/Wheel.model";
import * as functions from "firebase-functions";
import {ICompare, PriorityQueue} from "@datastructures-js/priority-queue";
/**
 * Roulette Service setups the Roulette options (users) and spins the wheen (return subset of users)
 */
export class RouletteService {
  private db: database.Database;

  /**
   * Comparator for the heap, to be able to dequeue items based on the least used and group size
   * @param {Group } a First group to compare
   * @param  {Group } b Second group to compare against
   * @return {ICompare<Group> } the group with more priority to be used
   */
  private groupsComparator: ICompare<Group> = (a: Group, b: Group) => {
    if (a.usersWithMeetings < b.usersWithMeetings) {
      return -1;
    }
    if (a.usersWithMeetings > b.usersWithMeetings) {
      return 1;
    }
    return a.availableUsersCount > b.availableUsersCount ? -1 : 1;
  };

  /**
   * Create new Roulette Service
   */
  constructor() {
    this.db = admin.database();
  }

  /**
   * Get Roulette Wheel setup
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   */
  private async getWheel(workspaceId: string, stepId: string): Promise<Wheel> {
    return (await (
      await this.db.ref(workspaceId).child(stepId).get()
    ).val()) as Wheel;
  }

  /**
   * Spin Roulette and get user results
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   */
  public async spinRoulette(workspaceId: string, stepId: string) {
    const wheel = await this.getWheel(workspaceId, stepId);
    const groups = this.getGroups(wheel);
    for (const users of groups) {
      for (const user of users) {
        await this.updateSpinCount(workspaceId, stepId, user);
      }
    }
    return groups;
  }

  /**
   * Generate N numbwe of groups  of M size using all users available on the Wheel setup
   * @param {Wheel} wheel
   * @param {number} groupSize size of the result groups
   * @param {number} numberOfGroups number of result groups
   * @return {Array<Array<User>>} result grups of users
   */
  private getGroups(wheel: Wheel): Array<Array<User>> {
    const groupsQueue = PriorityQueue.fromArray<Group>( Object.values(wheel.groups), this.groupsComparator );
    const subgroups = [];
    while ( subgroups.length < wheel.numberOfResults && groupsQueue.size() > 0 ) {
      const subgroup = this.createGroup(groupsQueue, wheel.resultSize);
      subgroups.push(subgroup);
    }
    return subgroups;
  }

  /**
   * Get a random user from the provided group
   * @param {Group} group Group containing all users
   * @return {User} a user
   */
  private getRandomUser(group: Group): User {
    const userKeys = Object.keys(group.users);
    const userIndex = Math.floor(Math.random() * userKeys.length);
    return group.users[userKeys[userIndex]];
  }

  /**
   * Create a group of users from different groups
   * @param { PriorityQueue<Group>} groupQueue Groups priority queue (heap) order by less used groups
   * @param {number} size Size of the group
   * @return {Array<User>} Group of users
   */
  private createGroup( groupQueue: PriorityQueue<Group>, size: number ): Array<User> {
    const subgroup: Array<User> = [];
    let currGroup = null;
    while ( subgroup.length < size && (currGroup = groupQueue.dequeue()) != null ) {
      const randomUser = this.getRandomUser(currGroup);
      const user = {...randomUser};
      currGroup.availableUsersCount--;
      currGroup.usersWithMeetings++;
      delete currGroup.users[user.userId];
      subgroup.push(user);
      if (currGroup.availableUsersCount > 0) {
        groupQueue.enqueue(currGroup);
      }
    }
    return subgroup;
  }

  /**
   * Creates workflow roulette wheel (saves users list into database)
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   * @param {User} user User to update count
   */
  public async updateSpinCount( workspaceId: string, stepId: string, user: User ) {
    await this.db
        .ref(workspaceId)
        .child(stepId)
        .child("groups")
        .child(user.groupId)
        .child("users")
        .child(user.userId)
        .update({count: user.count + 1});
  }

  /**
   * Creates workflow roulette wheel (saves users list into database)
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   * @param {Array<Array<string>>} users List of user identifiers to be included in the roulette
   * @param {number} subsetSize size of result subset
   * @param {number} numberOfResults size of results to generate
   */
  public async setupWheel(
      workspaceId: string,
      stepId: string,
      users: Array<Array<string>>,
      subsetSize: number,
      numberOfResults: number
  ) {
    const wheel: Wheel = {
      resultSize: subsetSize,
      stepId: stepId,
      workflowId: workspaceId,
      groupCount: users.length,
      numberOfResults,
      groups: {},
    };
    for (const usersArr of users) {
      const groupKey = this.db.ref(workspaceId).child(stepId).push().key;
      if (groupKey != null) {
        const group: Group = {
          availableUsersCount: usersArr.length,
          usersWithMeetings: 0,
          id: groupKey,
          users: {},
        };
        wheel.groups[groupKey] = group;
        for (const userId of usersArr) {
          const userObj: User = {count: 0, userId: userId, groupId: groupKey};
          wheel.groups[groupKey].users[userId] = userObj;
        }
      }
    }
    functions.logger.debug("SETUP", wheel);
    await this.db.ref(workspaceId).child(stepId).set(wheel);
  }
}
