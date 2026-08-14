# When Kevin sends an official channel link

This is the studio’s safe handoff after Kevin creates YouTube or LinkedIn.

## What the recording proves

- Kevin supplied the exact public URL.
- The URL has the right official domain and shape.
- The company register and founder dashboard agree that the channel exists.

## What it does not prove

- The link has been checked live yet.
- The website may link to it yet.
- A video or post is approved.
- Comments, messages or replies may open.
- Paid promotion is allowed.

## Studio sequence

1. Run a dry check of the exact URL. Nothing is changed.
2. Read the receipt and compare the URL character by character with Kevin’s link.
3. Record it locally only when the receipt still says publication, engagement, website linking and paid promotion are false.
4. Open the public URL read-only and verify the Mythical Void name and artwork.
5. Prepare a separate website-link release. Do not quietly add the channel to the public website.
6. Put one exact first release in front of Kevin. Approval is for that title, wording, image or video, audience choice, time and engagement setting together.

The recording command is intentionally conservative:

```sh
npm run record:official-channel -- \
  --platform youtube \
  --url https://www.youtube.com/@THE_REAL_HANDLE \
  --confirmed-by "Kevin Murphy"
```

That is a dry run. After checking its receipt, repeat it with `--apply` to update the register and founder dashboard. Use `--platform linkedin` with an exact `https://www.linkedin.com/company/...` Page URL for LinkedIn.

Never paste passwords, session links, invitation tokens, private profile URLs or URLs containing tracking details into this command.
