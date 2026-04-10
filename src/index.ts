import { analyzeEmail } from "./analyzers/emailAnalyzer.ts";
import type { AccountProfile, EmailMessage } from "./domain/models.ts";
import { createExperimentIdentity } from "./identity/emailIdentity.ts";
import { createScenarioRun, materializeScenarioActions, zillowScenarioLibrary } from "./scenarios/zillow.ts";

function main(): void {
  const identity = createExperimentIdentity(
    {
      site: "zillow",
      scenarioKey: "new-user-saved-search",
      runId: "r001",
      tags: ["mvp", "zillow", "saved-search"],
    },
    {
      mode: "custom-domain-catchall",
      domain: "signals.example.com",
    },
  );

  const account: AccountProfile = {
    id: "acct-001",
    site: "zillow",
    identityId: identity.id,
    signupUrl: "https://www.zillow.com/",
    createdAt: new Date().toISOString(),
  };

  const scenario = zillowScenarioLibrary[0];
  const run = createScenarioRun(account.id, scenario);
  const actions = materializeScenarioActions(run.id, scenario);

  const simulatedEmail: EmailMessage = {
    id: "email-001",
    runId: run.id,
    messageId: "<sample-message-id>",
    receivedAt: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
    from: "Zillow <updates@zillowmail.com>",
    subject: "Homes you may like in Seattle",
    category: "recommendation",
    gmailTab: "promotions",
    gmailLabelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    html: `
      <html>
        <body>
          <a href="https://www.zillow.com/homedetails/sea-101">Home 1</a>
          <a href="https://www.zillow.com/homedetails/sea-103">Home 2</a>
          <a href="https://www.zillow.com/account/email-preferences/">Preferences</a>
        </body>
      </html>
    `,
    links: [
      "https://www.zillow.com/homedetails/sea-101",
      "https://www.zillow.com/homedetails/sea-103",
      "https://www.zillow.com/account/email-preferences/",
    ],
  };

  const analysis = analyzeEmail(simulatedEmail, actions);

  console.log(
    JSON.stringify(
      {
        identity,
        account,
        run,
        actions,
        simulatedEmail,
        analysis,
      },
      null,
      2,
    ),
  );
}

main();
