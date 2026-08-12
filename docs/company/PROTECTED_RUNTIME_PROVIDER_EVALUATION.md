# Mythical Protected Runtime Provider Evaluation

**Status:** Shortlist complete; provider selection and activation gated  
**Date:** 11 August 2026  
**Control:** A-037 protected-runtime provider feasibility assurance

## Outcome

A-037 converts A-031's vendor-neutral PR-001 architecture into a source-backed
provider shortlist. It recommends **Google Cloud Run Jobs only for the next
bounded review**. It does not select Google Cloud, accept terms, create an
account, configure a credential, provision infrastructure, enable a schedule,
create a store, deliver an alert, authorize spend, or run a workload.

The machine-readable evidence is
[`automation/protected-runtime-provider-evaluation.json`](automation/protected-runtime-provider-evaluation.json).

## Shortlist

| Rank | Candidate | Current disposition | Why |
| ---: | --- | --- | --- |
| 1 | Google Cloud Run Jobs stack | Recommended for security/privacy/cost review; not selected | Job-native timeouts, retries and parallelism; service identity; separate scheduling; VPC egress controls; retention-locked storage |
| 2 | AWS ECS/Fargate stack | Credible higher-complexity alternative | Strong task-role isolation, scheduling, WORM storage, secrets, and budget components, with more IAM and operational surface |
| 3 | GitHub-hosted Actions | Bootstrap only; not independent assurance | Low friction and OIDC support, but repository-coupled source, workflow, execution, and evidence weaken the AG-001/AG-010 separation boundary |

This ordering is an inference from current official capability documentation
and Mythical's unusually strict no-write, independent-assurance boundary. It is
not a procurement recommendation. Exact plan, region, data handling, security,
privacy, terms, pricing, account ownership, recovery, support, and exit evidence
remain unverified for every candidate.

## Primary evidence reviewed

Google documents [Cloud Run job limits and retry controls](https://cloud.google.com/run/docs/create-jobs),
[user-managed service identity](https://docs.cloud.google.com/run/docs/securing/service-identity),
[separately authenticated scheduling](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule),
[VPC egress and firewall controls](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc),
and [retention-locked Cloud Storage](https://docs.cloud.google.com/storage/docs/bucket-lock).

AWS documents [standalone ECS tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/standalone-tasks.html),
[Fargate task-role isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html),
[EventBridge scheduling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/tasks-scheduled-eventbridge-scheduler.html),
[S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html),
[Secrets Manager lifecycle controls](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html),
and [budget actions](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html).

GitHub documents [OIDC workload claims and permissions](https://docs.github.com/en/actions/reference/security/oidc),
[workflow concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency),
and [environment protection behavior and plan limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## Required next review

If Kevin confirms PE-001 for deeper evaluation, the next step is a read-only
review of the exact account/project boundary, Irish/EU region and data flows,
controller/processor terms, security and incident evidence, service identities,
network-deny design, log minimization, immutable history, alert failure,
secretless operation, pricing for the 4-run/day ceiling, hard cost stop, kill
behavior, backup/restore, replay resistance, and exit/deletion route.

A response may choose what to evaluate. It cannot authorize account creation,
terms acceptance, access, credentials, provisioning, scheduling, persistence,
alerts, spend, or execution. Those remain separate A-031, A-035, A-011, finance,
security, privacy, and human approval gates.

A-038 has now completed the public PE-001 diligence possible before that
decision. See
[`PE001_GOOGLE_CLOUD_PUBLIC_DUE_DILIGENCE.md`](PE001_GOOGLE_CLOUD_PUBLIC_DUE_DILIGENCE.md).
