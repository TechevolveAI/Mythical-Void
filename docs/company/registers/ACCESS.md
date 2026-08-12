# Access Register

This register names capability needs without recording credentials or secrets.
The machine-readable activation and sequencing source of truth is
[`../automation/integration-activation.json`](../automation/integration-activation.json),
governed by A-035. An observed human session is not an agent connector; a
successful read is not write authority; a Kevin response is not an access
grant.

| System | Access state | First required capability | Minimum role | Purpose | Approval/status |
| --- | --- | --- | --- | --- | --- |
| GitHub repository | Authenticated; admin permission observed | Read/write working copy | Existing local access | Company artifacts and release coordination | Read used; do not commit/push or disturb Game Development work without coordination |
| Public website | Public read available | Read/verification | None | Footprint and deployment verification | Active |
| Netlify | Authenticated to `mythicalvoid` project | Deployment status/logs; later coordinated deploy | Existing account has broad access; use read-only for company task | Verify deployment and discovery state | Read used; production deploys are active in Game Development, so no company-task deploy |
| Domain/DNS | Unknown | Domain ownership and DNS read | Read first | Search verification and domain health | Not yet requested |
| Search Console/webmaster tools | Unknown | Property read and sitemap submit | Restricted user | Indexing, queries, crawl issues | Next small access bundle |
| Analytics | None identified | Existing aggregate reports, if any | Read | Establish baseline before tool choice | Privacy decision required before adding |
| General inbox | Unknown | Taxonomy/sample or read-only inbox | Read first | Support and enquiry workflow | Escalation policy required |
| Parent inbox | Unknown | Taxonomy/sample or read-only inbox | Read first | Parent concerns and trust research | Sensitive-case policy required |
| Social accounts | Unknown | Inventory and analytics read | Read first | Establish footprint and channel fit | Do not request publishing yet |
| Customer research store/CRM | None identified | Schema only | None initially | Evidence and follow-up | Tool choice deferred |
| Research scheduling/recruitment | None identified | Adult participant scheduling only | Restricted research owner | Run Round 001A without putting contacts in shared registers | D-008 and retention/compensation decision required |
| Finance/payments/contracts | Restricted/unknown | None | None | Future commercial operations | Per-action Kevin approval |
| Protected internal agent runtime | None selected or connected | Architecture class, isolated workload identities, read-only ephemeral runner, protected metadata history, and authenticated exception route | Separate least-privilege orchestrator, assurance, scheduler, writer, and reader roles | Eligible AG-001/AG-010 shadow cycles | A-031 package ready; D-017, security/privacy review, provider/access approval, and all 18 readiness gates required |

Access rules:

- never place credentials, tokens, personal data, or recovery codes here;
- request read access before write access;
- prefer dedicated least-privilege service identities;
- name an owner and remove access when the workflow ends;
- production, finance, legal, and sensitive customer access always require
  explicit approval.
