# Element job feed

Turns the careers feed on everybitmatters.com into a clean `jobs.xml` for digital signage, updated automatically every 15 minutes.

```
index.html                          the sign (what the player shows)
assets/background.jpg               background exported from Figma
.github/workflows/update-jobs.yml   the schedule (tells GitHub when to run)
scripts/update-jobs.mjs             the sync script (fetch, clean, write)
feeds/jobs.xml                      the output your sign will read
```

## Set it up

1. On github.com, create a new **Public** repository, e.g. `element-jobs-feed`.
2. **Add file → Upload files**, and drag in `index.html` plus the `assets`, `scripts` and `feeds` folders. Commit.
3. **Add file → Create new file**. For the name, type exactly `.github/workflows/update-jobs.yml`
   (typing the slashes creates the folders). Paste in the contents of `update-jobs.yml` and commit.
   This step is done by hand because Mac and Windows hide folders starting with a dot, so they often get skipped in uploads.
4. Open the **Actions** tab, click **Update job feed**, then **Run workflow** to test it right away.
5. Turn on **Settings → Pages** (deploy from branch `main`, folder `/ (root)`). Your sign is then live at:
   `https://YOUR-USERNAME.github.io/element-jobs-feed/`
   That's the URL you'd load into the signage player as a web page.

If the run fails at the "Save changes" step with a permission error, go to
**Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, and save.

## What the cleanup does

| In the website feed | In jobs.xml |
|---|---|
| `portsmouth, nh-based design build  project manager` | **Design Build Project Manager**, location Portsmouth, NH |
| `digital and multi-media design internship program internship program` | **Digital and Multi-Media Design Internship Program** |
| `construction/ project management internship program` | **Construction/Project Management Internship Program** |
| `Graphic Design &#038; Environmental...` | **Graphic Design & Environmental...** |

Any title containing "intern" or "internship" gets `employmentType` set to Internship. Other jobs leave it blank, since the feed doesn't say.

## Good to know

- **Safety net:** if the website is down or returns something that isn't a feed, the run fails, GitHub emails you, and the last good `jobs.xml` stays in place.
- **Quiet history:** the script only commits when the jobs actually change, not every 15 minutes.
- **Keep it awake:** GitHub pauses scheduled workflows in public repos after 60 days with no activity. If the jobs don't change for two months, you'll get an email; click **Enable workflow** on the Actions tab to resume.
- **Test on your computer** (needs Node 20+): `node scripts/update-jobs.mjs`
