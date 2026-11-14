# Test HelpMe questions in local Canvas

Use this guide to connect Canvas in Docker to HelpMe running with `yarn dev`.
The setup uses HTTP and the local name `helpme.test`:

- Open Canvas at `http://helpme.test`.
- Open HelpMe at `http://helpme.test:3100`.
  - (localhost:3000 doesn't work since inside Canvas's container, "localhost" refers to the container itself. They also both need to be on the same origin (http://helpme.test) for embedded auth to work (local LTI cookies use SameSite=Lax))
- Keep HelpMe's existing development proxy on port `3000`. A forwarding process connects port `3100` to it.

Publish Canvas on port `80`, not `8080`. The local Canvas dynamic-registration URL can omit non-default ports.
If port `80` is already occupied, stop the conflicting service before following this guide.

Keep `NODE_ENV=development`. You do not need Portless or HTTPS certificates for this workflow.

For background on the LMS integration and authentication setup, see [the original LTI PR (#351)](https://github.com/ubco-db/helpme/pull/351).

## Prepare the applications

1. Follow [the HelpMe development guide](DEVELOPING.md#installation-to-run-locally) to install dependencies and create the environment files.
2. Install Docker using [Docker's installation instructions](https://docs.docker.com/get-started/get-docker/).
3. Clone the [official Canvas repository](https://github.com/instructure/canvas-lms) into a separate directory from HelpMe:

   ```sh
   git clone https://github.com/instructure/canvas-lms.git
   cd canvas-lms
   ```

4. Follow [Canvas's Docker setup guide](https://github.com/instructure/canvas-lms/blob/master/doc/docker/README.md). Complete its prerequisites, run `./script/docker_dev_setup.sh`, and follow the script's **Next Steps** output (creating an admin account and org).
   1. (Linux) If it asks to install `dory`, skip it since it's not necessary for this setup.
   2. (Linux) If it can't find `docker.service` even though docker desktop is running, you may need to open `/script/common/os/linux/impl.sh` and replace `eval "$service_manager docker status &> /dev/null" && return 0` with `docker info &> /dev/null && return 0` depending on your docker installation.

The commands below assume that Canvas uses Compose services named `web` and `jobs`.
Run Canvas Compose commands from the Canvas checkout. Run HelpMe commands from the HelpMe checkout.
On Windows, keep HelpMe and Docker Desktop in the same development environment. A separate WSL networking layer requires additional connectivity checks.

## 1. Let the browser and Canvas reach HelpMe

### Add the name on your computer

Open your hosts file with administrator privileges:

- macOS and Linux: `/etc/hosts`.
- Windows: `C:\Windows\System32\drivers\etc\hosts`. Open your text editor as Administrator.

Add this line:

```text
127.0.0.1 helpme.test
```

This entry makes your browser resolve `helpme.test` to your computer.

### Add the name inside Docker

Inside Canvas' checkout, open `docker-compose.override.yml` and merge these settings into the existing services:

```yaml
services:
  web:
    ports:
      - '80:80'
    extra_hosts:
      - 'helpme.test:host-gateway'
  jobs:
    extra_hosts:
      - 'helpme.test:host-gateway'
```

Preserve the existing service settings. If `80:80` already exists, do not add it again.
The `host-gateway` value tells Docker to resolve the name to the computer running Docker.
See [Docker's custom hostname configuration](https://docs.docker.com/compose/how-tos/networking/#custom-dns-with-extra_hosts).

In Canvas's `config/domain.yml`, set the development address:

```yaml
development:
  domain: 'helpme.test'
  ssl: false
```

Preserve the other environments in that file. Apply the Docker configuration:

```sh
docker compose up -d web jobs
```

Open `http://helpme.test/login/canvas`. Expect the local Canvas login page.
If your Canvas version has a separate allowed-host setting, add `helpme.test` there when Canvas reports a blocked host.

### Allow Canvas to fetch HelpMe's signing keys

Canvas's HTTP client blocks requests to private IP addresses by default, including the Docker host address used by `helpme.test`. Browser launches and even `curl` from the container can work while inserting a question fails with `Fetching JWK from public_jwk_url failed` and `JWT verification failure`.

In the **Canvas checkout**, create `config/initializers/local_helpme_http.rb`:

```ruby
# Local development only: allow the Docker host used by HelpMe.
if Rails.env.development?
  CanvasHttp.singleton_class.prepend(Module.new do
    def insecure_host?(host)
      return false if host == "helpme.test"

      super
    end
  end)
end
```

Restart Canvas to load the initializer:

```sh
docker compose restart web jobs
```

This bypasses Canvas's private-address protection only for `helpme.test` in development.

### Set HelpMe's .env variables

In `packages/server/.env`, set:

```dotenv
NODE_ENV=development
DOMAIN=http://helpme.test:3100
```

Keep the existing database settings and `LTI_SECRET_KEY`. Do not replace an existing LTI secret: the registration database uses it for encryption.

In `packages/frontend/.env`, set:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://helpme.test:3100
NEXT_PUBLIC_HOST_PROTOCOL=http
NEXT_PUBLIC_HOSTNAME=helpme.test
NEXT_PUBLIC_DEV_PORT=3100
```

### Start the forwarder proxy

In another terminal, start the forwarder:

```sh
node -e 'const net=require("net"); net.createServer(client=>{const upstream=net.connect(3000,"127.0.0.1"); client.pipe(upstream).pipe(client); client.on("error",()=>upstream.destroy()); upstream.on("error",()=>client.destroy())}).listen(3100,"0.0.0.0",()=>console.log("Forwarding :3100 -> :3000"))'
```

Expect `Forwarding :3100 -> :3000`. Leave this terminal open while you test.
The forwarder accepts connections from Docker. It does not register HelpMe or configure hostnames.

### Test the connection

Open `http://helpme.test:3100` in your browser to check if HelpMe is running.

To check the connection from Canvas (you may need to change `canvas-lms-web-1` to your container name):

```sh
docker exec canvas-lms-web-1 curl --fail --show-error http://helpme.test:3100/api/v1/lti/keys
```

Expect a JSON document containing a `keys` array. Fix connection errors before you continue to registration (make sure you're not erroring with "FAILED TO INITIALIZE LTI AS A MIDDLEWARE" when starting up HelpMe).
If your container has no `curl`, run this equivalent check:

```sh
docker exec canvas-lms-web-1 ruby -rnet/http -e 'r=Net::HTTP.get_response(URI("http://helpme.test:3100/api/v1/lti/keys")); abort("HTTP #{r.code}") unless r.is_a?(Net::HTTPSuccess); puts r.body'
```

Also test through **Canvas's HTTP client**, which applies security checks that `curl` and `Net::HTTP` do not. Run this from the Canvas checkout:

```sh
docker compose exec web bundle exec rails runner -e development 'r = CanvasHttp.get("http://helpme.test:3100/api/v1/lti/keys"); abort("HTTP #{r.code}") unless r.is_a?(Net::HTTPSuccess); puts r.body'
```

Expect the same JSON document with a `keys` array. If this raises `CanvasHttp::InsecureUriError`, ensure [this](#allow-canvas-to-fetch-helpmes-signing-keys) step was followed. - The corresponding Canvas log entry is `CANVAS_HTTP WARNING insecure address` followed by `Fetching JWK from public_jwk_url failed`.

## 2. Register HelpMe in Canvas

1. Head to `http:helpme.test` and login with your Canvas Admin account you made during the "Next Steps" part of the Canvas setup.
2. Create a test course on Canvas.
3. Go to Admin -> YourOrg -> Apps -> Manager -> Install a New App. Choose **Dynamic Registration**.
4. Enter `http://helpme.test:3100/api/v1/lti/register` as the **Dynamic Registration URL**. Continue clicking Next (defaults should be fine).
5. Complete the registration with the name `HelpMe`. Enable the registration if Canvas leaves it disabled.
6. Copy the client ID Canvas assigns to this registration (if it says Unable to copy client ID to clipboard, just copy the the number, e.g. 10000000000001).
7. Go to the test course you made -> Settings -> Apps -> +App -> Choose **By Client ID** for **Configuration Type**, and then enter the client ID you copied into the **Client ID** field.
8. Make the app available. Open **Admin**, **Apps**, **Manage**, open HelpMe, open **Availability and Exceptions**, and make it available for the account or add an exception for your test course. Save and reload the course. A course cannot use an unavailable deployment.
9. Head to Admin -> Developer Keys and create a new Developer Key.
   1. Give it a name of your choosing.
   2. For Redirect URI (Legacy), enter `http://helpme.test:3100/api/v1/dev-sso/login/1` (you may need to change the `1` to the HelpMe Org Id of the one you're setting this up with)
   3. Enable **Enforce Scopes** and select the scopes in `CANVAS_ACCESS_TOKEN_SCOPES` inside `packages/server/src/lmsIntegration/lmsIntegration.adapter.ts`.
   4. Enable **Allow Include Parameters**. Without this setting, Canvas silently ignores `include[]` on scoped OAuth requests, including `include[]=submission_history`.
   5. Click Save. Once created, enable it (turn State to On) if needed.
10. Copy the key's client ID (e.g. 10000000000002) and client secret/key (e.g. 9yCQHa...). This is for use in the next step. Note that this developer key is separate from the LTI registration; the two client IDs are not interchangeable.

Dynamic registration exchanges the signing-key URLs and launch URLs between Canvas and HelpMe. You do not need to generate or paste private signing keys.

(Optional) Check that the registered HelpMe URLs use these addresses (Under Admin -> Apps -> Manage -> HelpMe -> Usage):

- Login initiation: `http://helpme.test:3100/api/v1/lti/login`.
- Launch redirect: `http://helpme.test:3100/api/v1/lti`.
- Signing keys: `http://helpme.test:3100/api/v1/lti/keys`.

If you already have a working registration under another hostname, keep that setup or update the registration consistently before using this guide's addresses.
Changing the browser address alone does not update either application's stored registration.

## 3. Configure HelpMe

1. Sign in to HelpMe as a **site administrator** (`UserRole.ADMIN`, not the same as an organization administrator). Open **Admin Panel → LTI Platforms** and confirm that the Canvas registration from the previous step appears. You may notice that the platform URL is `https://canvas.instructure.com`, this is normal even for local Canvas.
2. In HelpMe, open **Organization Settings → LMS Integrations → Add New Integration**. Select Canvas, set **LMS Domain** to `helpme.test` without `http://`, turn **HTTPS** off for this local setup, and enter the **Developer Key Client ID** and **Developer Key Client Secret** from the step where you created the developer key on Canvas.
3. Return to **Admin Panel → LTI Platforms** and assign the Dynamic Canvas registration to the organization you just set up the LMS integration for.

On HelpMe, the organization-level integration stores the Canvas Developer Key and allows HelpMe to call Canvas endpoints (like for auto-synchronizing Chatbot documents). Or more specifically, it allows HelpMe to create 'Access Tokens' on a user's behalf, and those tokens are used to call the Canvas API.
On HelpMe, the site-level registration (the Dynamic Canvas registration) is for deep linking and what allows HelpMe to be embedded within Canvas; Canvas sends requests to HelpMe (via the LTI protocol) requesting for data to insert into an iframe (simplification). It exists on the site-level on HelpMe since HelpMe doesn't have a way to tell what organization the request for the dynamic registration belongs to.
Moreover, since there might be multiple Canvas instances (from different universities) each creating dynamic registrations with HelpMe, we manually map the site-level registration to a specific organization.

## 4. Connect the HelpMe course with the Canvas course

On HelpMe, create a course if you haven't already. Go to **Course Settings** -> **LMS Integrations** -> pick Canvas -> Generate a new Access Token. Select the Canvas course and then click Create. - Note that the user who makes the Access Token needs to have the correct permissions on the Canvas course (be able to edit content and grade assignments - so, TA or Prof level).

## Test an embedded question

1. Now that everything is set up and connected, simply go to Course Settings -> LMS Integrations -> Embeddable Questions page and create some embeddable questions.
2. On Canvas, go to Edit an assignment/quiz and create an essay question.
3. Click on the "Integrations" button (shows up as a little spark plug) and choose HelpMe. The list of embeddable questions should appear. Select and insert the one you want, and then click "Save Question".
4. Save the quiz/assignment.

Now, you can preview the quiz/assignment and try out the feedback embeddable question box!

Note that each use of the "Get Feedback" button will save the input + response into the database along with who submitted it (could be used for data analysis after the fact).

_Important:_ Note that you should also try the embeddable question box as a student Canvas account (probably in a fresh browser) to ensure it still works there.



### Feedback deployment and failures

Deploy chatbot's structured feedback support first; it continues accepting the
existing LTI caller's `params.systemPrompt`. Then apply the HelpMe migrations
(including `CanvasBatchRunError1790080000000`) and deploy HelpMe. Roll back HelpMe
before rolling back chatbot. Remove the legacy contract only after every caller
has migrated.

A failed run shows its error in Canvas Batch Grading and stops polling. Resolve
the error, check SpeedGrader, and start a new run. The failed run remains available
for review in the run selector; a new run freezes the current settings. A 401
requires checking the OAuth token and developer-key scopes and reconnecting if
necessary; a 403 requires checking the authorizing instructor's course access and
grading permissions. These messages also apply when Canvas
returns an HTML error page.

Rejected writes and unknown write outcomes appear separately in the report.
HelpMe does not retry either write. A durable write marker is saved before the
request. After a worker interruption, a resumed run reports any unconfirmed write
instead of resending it. HTTP 408, server/proxy errors, and network timeouts also
have unknown outcomes. Inspect SpeedGrader before starting another run; an
interrupted request may have reached Canvas. If grades succeeded but the review
comment is missing, add the report's review reasons manually; do not regrade.
A new run skips attempts that already have a Canvas grade or a posted grade.
HelpMe checks this only when a run starts, so do not grade, post, or edit the
quiz in Canvas while a run is active.

Answers longer than 15,000 characters are not truncated or sent to the model.
Grade them manually in SpeedGrader. Invalid model output also leaves the attempt
unwritten; inspect the answer and rubric, then grade manually or start a new run
after resolving the model/configuration problem. Report refresh failures have a
Retry action; do not infer completion from stale progress.

The worker holds one PostgreSQL connection for a run-level advisory lock. Keep
the connection pool larger than the number of active workers. The `writing`
attempt status uses the existing text column, so this recovery change requires
no additional migration. Stop old workers before deploying it.

## Start another development session

1. Start the Canvas Docker services.
2. Start the chatbot backend if you need feedback generation.
3. Run `yarn cross-env PORT=3001 yarn dev` in HelpMe.
4. Run the forwarding command in another terminal.
5. Open Canvas at `http://helpme.test`.

You do not need to register the app again unless you replace its databases or change its URLs.

## Resolve setup errors

- **Name not found in the browser:** Check the hosts entry on your computer.
- **Name not found inside Canvas:** Check `docker compose exec web getent hosts helpme.test`. Recreate the containers after changing `extra_hosts`.
- **Connection refused from Canvas:** Confirm that the forwarder is running on `3100` and HelpMe is running on `3000`.
- **Timeout from Canvas:** Check the Docker host mapping and local firewall. Docker distributions can route the host differently; verify the address with the connectivity command above.
- **Port already in use:** Stop the old forwarder before starting another copy. Do not change ports without updating the configured URLs.
- **Launch returns 403:** Check that the active LTI registration is assigned to the correct organization in HelpMe's LTI Platforms page. Staff also need a linked identity and course access.
- **Question picker works but Insert into Canvas fails with `Fetching JWK from public_jwk_url failed`:** Run the `CanvasHttp` check above. If Canvas logs `CanvasHttp::InsecureUriError`, apply the development-only signing-key fetch exception and restart Canvas. A successful `curl` check alone does not rule this out. For other failures, check the registered signing-key URL and Canvas logs before changing keys or re-registering.
- **Launch works but feedback fails:** Check the chatbot backend and the question's grading settings.
- **Old hostname appears after a redirect:** Update the existing app registration and HelpMe environment settings consistently. Reinsert saved Canvas links that contain the old hostname.

This HTTP setup uses the same hostname on different ports. It does not verify production HTTPS behavior or isolation between host-only cookies on separate hostnames.
