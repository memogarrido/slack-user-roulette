# User Roulette slack app

This app is intended to be used as [Workflow Step](https://api.slack.com/workflows/steps)

## About 

When creating a Slack workflow with this step, it will require users to provide one ore more sets of users to choose from, the amount of results to return and the size of the result (users )to return

### Examples:
- Providing a list of 10 users and choosing to return always 1 set of 1 random user.
- Providing a two lists of 10 users each and choosing to return always 4 sets of 5 random user.
    - In this scenario the roullete will have preference to combine users from different sets

### Example workflow

Trigger (daily) > Spin User Roulette (this app) > Send message `Hello world @user`

Where `@user` was an output from the "User Roulette"

## Using the project
### Getting started

Install dependencies:
```bash
npm run install
```

To run locally you can use [firebase emulators](https://firebase.google.com/docs/functions/local-emulator#run_the_emulator_suite) by running: 

```bash
npm run serve
```


### Publish

This project uses [Firebase Cloud Functions](https://firebase.google.com/docs/functions) and [Realtime Database](https://firebase.google.com/docs/database)

To host it your self you will need to:

1. Create a firebase project 
1. Enable billing (needed to run cloud functions)
1. Enable [Cloud Secrets Manager API](https://cloud.google.com/secret-manager)
1. Install [Firebase CLI](https://firebase.google.com/docs/cli)
1. Init firebase project `firebase init` to create `.firebaserc` **do not replace files**
1. Setup Slack secrets: [Signing Secret](https://api.slack.com/authentication/verifying-requests-from-slack#about) and workspace [Oauth Token](https://api.slack.com/authentication/oauth-v2)
    - `firebase functions:secrets:set SLACK_SIGNING_SECRET`
    - `firebase functions:secrets:set SLACK_TOKEN`
1. Deploy: `npm run deploy`