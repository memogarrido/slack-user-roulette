import {Block, KnownBlock, View, WebClient} from "@slack/web-api";
import {SetupActions, SetupFields} from "../../models/SetupFields.enum";
import {SetupOutputs} from "../../models/StepOutputs.enum";
import * as functions from "firebase-functions";
import {View as ViewOpenResponse} from "@slack/web-api/dist/response/ViewsOpenResponse";
/**
 * Service to interact with Slack Web API https://api.slack.com/apis
 */
export class SlackService {
  private client: WebClient;
  /**
   * Create a new slack Service
   * @param {string }token  OAuth Toke for the Workspace
   */
  constructor(token: string) {
    this.client = new WebClient(token);
  }

  /**
   * Reply to the step being excecuted succesfully
   * @param {string} workflowStepExecuteId Id of the step being excecuted
   * @param {Array<Array<string>>} users List of resulting conversations
   */
  public async eventSuccessReply( workflowStepExecuteId: string, users: Array<Array<string>>) {
    const outputs: { [key: string]: string } = {};
    for (let j = 0; j < users.length; j++) {
      for (let i = 0; i < users[j].length; i++) {
        outputs[`${SetupOutputs.RouletteResultUser}_g${j}_u${i}`] = users[j][i];
      }
    }
    functions.logger.debug("COMPLETED STEP:", outputs, users);
    await this.client.workflows.stepCompleted({
      workflow_step_execute_id: workflowStepExecuteId,
      outputs: outputs,
    });
  }

  /**
   * Crate slack conversation
   * @param {Array<string>} users Users to be invited to the conversation
   * @return {string | null} the resulting channel
   */
  public async createConversation(users: Array<string>) {
    const conversation = await this.client.conversations.open({
      users: `${users.join(",")}`,
    });
    if (conversation.ok && conversation.channel && conversation.channel.id) {
      functions.logger.info("Conversation created", conversation);
      return conversation.channel.id;
    }
    return null;
  }

  /**
   * Open Configuration Modal on slack workflows
   * @param {string}triggerId Trigger id Received on the workflow_step_edit event
   * {@link workflow_step_edit https://api.slack.com/reference/workflows/workflow_step_edit}
   * @param {Array<KnownBlock>} blocks Block UI for the workflow setup modal
   * {@link block-kit https://api.slack.com/reference/block-kit/blocks}
   */
  public async openConfigurationModal( triggerId: string, blocks: Array<KnownBlock> ) {
    await this.client.views.open({
      trigger_id: triggerId,
      view: {
        type: "workflow_step",
        blocks: blocks,
        submit_disabled: true,
      },
    });
  }

  /**
   * Update configuration modal with a given view
   * @param {string} triggerId Trigger Id
   * @param {View} view Updated view
   * @param {number} userSetsSize Number of user list fields to add to the view
   */
  public async updateConfigModalWithUserInputs( triggerId: string, view: ViewOpenResponse, userSetsSize: number ) {
    const userBlocks: Array<KnownBlock> = [];
    for (let i = 0; i < userSetsSize; i++) {
      userBlocks.push(this.createUserInput(i + 1));
    }
    const existingBlocks:Array<Block | KnownBlock> = [];
    if (view.blocks) {
      for (const block of view.blocks) {
        if (block.type !== "actions") {
          existingBlocks.push( block as Block);
        }
      }
    }
    if (view && view.id && view.blocks) {
      view.submit_disabled = false;
      const updateResult = await this.updateConfigurationModal(view.id, triggerId, {
        blocks: [...existingBlocks, ...userBlocks],
        type: "workflow_step",
        submit_disabled: false,
      });
      functions.logger.debug(updateResult);
    }
  }

  /**
   * Update configuration modal with a given view
   * @param {string} viewId Id fo view to update
   * @param {string} triggerId Trigger Id
   * @param {View} view Updated view
   */
  private async updateConfigurationModal( viewId: string, triggerId: string, view: View ) {
    await this.client.views.update({
      view_id: viewId,
      trigger_id: triggerId,
      view: view,
    });
  }

  /**
   * Save Spin roulette Step into workflow
   * @param {string } workflowStepEditId Obtained from the workflow_step_edit  event
   * {@link workflowStepEditId https://api.slack.com/reference/workflows/workflow_step_edit}
   * @param {number } resultSize number of resulting users form spinning the roulette
   * @param {number } numberOfResults number of resulting users form spinning the roulette
   */
  public async saveUserRouletteWorkflowStep(
      workflowStepEditId: string,
      resultSize: number,
      numberOfResults: number
  ) {
    const outputs = [];
    for (let j = 0; j < numberOfResults; j++) {
      for (let i = 0; i < resultSize; i++) {
        outputs.push({
          type: "user",
          label: `Group ${j + 1} User ${i + 1}`,
          name: `${SetupOutputs.RouletteResultUser}_g${j}_u${i}`,
        });
      }
    }
    const workflowStep = {
      outputs: outputs,
      workflow_step_edit_id: workflowStepEditId,
      step_name: "Spint user roulette",
    };
    functions.logger.debug("STEP", workflowStep);
    await this.client.workflows.updateStep(workflowStep);
  }

  /**
   * Open User Roulette Configuration Modal on slack workflows
   * @param {string}triggerId Trigger id Received on the workflow_step_edit event
   * {@link https://api.slack.com/reference/workflows/workflow_step_edit}
   */
  public async openUserRouletteConfigurationModal(triggerId: string) {
    await this.openConfigurationModal(triggerId, [
      {
        type: "input",
        block_id: SetupFields.NumberOfResults,
        element: {
          initial_value: "1",
          type: "plain_text_input",
          action_id: "title",
          placeholder: {
            type: "plain_text",
            text: "How many results do you want to get?",
          },
        },
        label: {
          type: "plain_text",
          text: "Number of results to generate?",
          emoji: false,
        },
        hint: {
          type: "plain_text",
          text: "How many spins to the roullete? (with unique results, will max out to the number of users available)",
        },
      },
      {
        type: "input",
        block_id: SetupFields.SubgroupSize,
        element: {
          type: "plain_text_input",
          action_id: "title",
          initial_value: "1",
          placeholder: {
            type: "plain_text",
            text: "How many users do you want the roulette to return on each result?",
          },
        },
        label: {
          type: "plain_text",
          text: "Number of users to return on each result",
          emoji: false,
        },
        hint: {
          type: "plain_text",
          text: "Size of the resulting group(s)/result(s) generated",
        },
      },

      {
        type: "input",
        block_id: SetupFields.NumberOfInputGroups,
        element: {
          type: "plain_text_input",
          action_id: "title",
          initial_value: "1",
          placeholder: {
            type: "plain_text",
            text: "Amount of users being fed to the roulette",
          },
        },
        label: {
          type: "plain_text",
          emoji: false,
          text: "How many set of users do you have as input?",
        },
        hint: {
          type: "plain_text",
          /* eslint-disable max-len */
          text: "If you provide different set of users, results will avoid returning users from the same input set",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Continue",
            },
            action_id: SetupActions.SaveGeneralSetup,
          },
        ],
      },
    ]);
  }

  /**
   * Create a slack block to request a user list
   * @param {number} id to identify the group of users to be gathered
   * @return {KnownBlock} a Slack building block
   */
  public createUserInput(id: number): KnownBlock {
    return {
      type: "input",
      block_id: `${SetupFields.Users}${id}`,
      element: {
        type: "multi_users_select",
        placeholder: {
          type: "plain_text",
          text: "Select users",
          emoji: false,
        },
        action_id: "multi_users_select-action",
      },
      label: {
        type: "plain_text",
        text: `Users to choose from for Group ${id}`,
        emoji: false,
      },
    };
  }
}
