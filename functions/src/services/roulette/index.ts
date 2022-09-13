import * as admin from "firebase-admin";
import {database} from "firebase-admin";
import {User, Wheel} from "../../models/Wheel.model";
import * as functions from "firebase-functions";
/**
 * Roulette Service setups the Roulette options (users) and spins the wheen (return subset of users)
 */
export class RouletteService {
  private db: database.Database;
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
    const userResult:Array<string> =[];
    const users =this.getUsersAvailable(wheel.resultSize, Object.values(wheel.users));
    functions.logger.debug("users", users);
    const randomizedUserRoulette = this.randomizeRoulette(users);
    functions.logger.debug("random", randomizedUserRoulette);
    for (let i=0; i<wheel.resultSize; i++) {
      userResult.push(randomizedUserRoulette[i].userId);
      await this.updateSpinCount(workspaceId, stepId, randomizedUserRoulette[i]);
    }
    return userResult;
  }

  /**
   * Get the users to be available on the roulette (excluding the ones that have been selected the most)
   * @param {number} minimum Minimum amount of users tp exist on the roulette
   * @param {Array<User>} users All users universe from the wheel
   * @return {Array<User>} Users avialable to suffle
   */
  private getUsersAvailable( minimum:number, users:Array<User>) {
    const minCountUser = users.reduce(function(prev, curr) {
      return prev.count < curr.count ? prev : curr;
    });
    let participationCountThreshold = minCountUser.count;
    let usersWithMinimumCount:Array<User>=[];
    while (usersWithMinimumCount.length<minimum) {
      const filteredUsers=users.filter((user)=>user.count===participationCountThreshold);
      usersWithMinimumCount = usersWithMinimumCount.concat(filteredUsers);
      participationCountThreshold++;
    }
    return usersWithMinimumCount;
  }

  /**
   * Ramdpmize roulette options
   * https://stackoverflow.com/a/2450976/1537389
   * @param {Array<User>} users Users available on roulette
   * @return {Array<User>} Users on random order
   */
  private randomizeRoulette(users:Array<User>) {
    let currentIndex = users.length;
    const randomizedUsers = [...users];
    let randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [randomizedUsers[currentIndex], randomizedUsers[randomIndex]] = [
        randomizedUsers[randomIndex], randomizedUsers[currentIndex]];
    }
    return randomizedUsers;
  }

  /**
   * Creates workflow roulette wheel (saves users list into database)
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   * @param {User} user User to update count
   */
  public async updateSpinCount( workspaceId: string, stepId: string, user:User ) {
    await this.db.ref(workspaceId).child(stepId).child("users").child(user.userId).update({count: user.count+1});
  }

  /**
   * Creates workflow roulette wheel (saves users list into database)
   * @param {string} workspaceId Workspace Id Obtained from the workflow_step_execute event_callback
   * @param {string} stepId Step Id Obtained from the workflow_step_execute event_callback
   * @param {Array<string>} users List of user identifiers to be included in the roulette
   * @param {number} subsetSize size of result subset
   */
  public async setupWheel(
      workspaceId: string,
      stepId: string,
      users: Array<string>,
      subsetSize: number
  ) {
    const wheel: Wheel = {
      resultSize: subsetSize,
      stepId: stepId,
      workflowId: workspaceId,
      users: {},
    };
    for (const user of users) {
      wheel.users[user] = {count: 0, userId: user};
    }
    functions.logger.debug("SETUP", wheel);
    await this.db.ref(workspaceId).child(stepId).set(wheel);
  }
}
