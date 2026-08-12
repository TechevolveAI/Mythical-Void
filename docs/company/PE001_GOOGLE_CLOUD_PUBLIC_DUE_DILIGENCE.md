# PE-001 Google Cloud Public Due Diligence

**Status:** Conditional pass for account-scoped review only  
**Date:** 11 August 2026  
**Control:** A-038 PE-001 public due-diligence assurance

## Conclusion

Current official documentation supports continuing Google Cloud Run Jobs into a
bounded account-specific review. It does not support provider selection or
deployment. Seven of Mythical's twelve platform requirements have a plausible
documented route; five have only partial public evidence. None has configuration
or test evidence, and all fourteen account/human gates remain unsatisfied.

The machine-readable source is
[`automation/pe001-public-due-diligence.json`](automation/pe001-public-due-diligence.json).

## Material findings

- Cloud Run jobs support configurable task count, parallelism, retries and
  timeout. Jobs use disposable containers with an in-memory filesystem, and
  timeout or cancellation leads to termination. [Job configuration](https://cloud.google.com/run/docs/create-jobs),
  [runtime contract](https://docs.cloud.google.com/run/docs/container-contract)
- User-managed service accounts provide short-lived service identity without a
  stored application credential. Mythical still needs four separately reviewed
  identities and policies. [Service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)
- Images can be addressed by immutable SHA-256 digest. No Mythical runtime image
  or reviewed provenance exists. [Artifact Registry image identity](https://docs.cloud.google.com/artifact-registry/docs/container-concepts)
- Cloud Storage can lock retention against deletion or replacement, but locking
  is irreversible and requires a legal/retention/exit decision. [Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- Cloud Logging provides encryption, regional buckets, retention and IAM/view
  controls; this does not itself prevent sensitive output from being logged.
  [Log storage](https://docs.cloud.google.com/logging/docs/store-log-entries),
  [log access](https://docs.cloud.google.com/logging/docs/access-control)
- Monitoring recommends redundant notification paths because several channel
  types share a failure domain, and it warns that notification payloads may be
  sensitive. Mythical has no authenticated recipient or tested route.
  [Notification channels](https://docs.cloud.google.com/monitoring/support/notification-options)
- Running executions can be cancelled while retaining configuration, log and
  monitoring evidence, and service accounts can be disabled. The complete kill
  procedure still needs an independent exercise. [Cancel executions](https://docs.cloud.google.com/run/docs/execute/jobs),
  [disable service accounts](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable)

## Region and privacy

No Irish Cloud Run region is listed. Belgium (`europe-west1`), Netherlands
(`europe-west4`) and Finland (`europe-north1`) are Tier-1 European candidates;
Google states that data associated with a Cloud Run resource is stored in the
selected region. [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations)

The current DPA describes Google as processor where applicable, references
subprocessors and European transfer mechanisms, and also allows processing in
countries where Google or its subprocessors operate subject to applicable
location and transfer commitments. This requires professional review; it is not
an accepted contract or a complete data-transfer assessment. [Cloud DPA](https://cloud.google.com/terms/data-processing-addendum/)

## Cost boundary

Google's published example for 730 one-minute monthly Cloud Run job executions
in Belgium at 1 vCPU and 512 MiB estimates USD 0 with free tier and USD 0.45
without it. Mythical's current ceiling is 120 executions and 240 maximum billed
minutes monthly, but that comparison excludes Scheduler, Artifact Registry,
Storage, Logging, Monitoring, networking, tax, currency conversion and support.
It therefore does not establish Mythical's cost. [Cloud Run pricing](https://cloud.google.com/run/pricing)

Cloud Run is documented as eligible for preview spend-cap budgets, but
enforcement is not instantaneous, in-flight work can finish and persistent
resources can keep accruing cost. A spend cap is a secondary control, not the
sole hard stop. [Spend-cap budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)

## Decision boundary

Kevin may approve an account-scoped review after confirming the cell, owner,
backup and urgent recipient. That approval must remain distinct from provider
selection, terms acceptance, billing attachment, account/project creation,
provisioning, credentials, scheduling, stores, alerts, spend and execution.
