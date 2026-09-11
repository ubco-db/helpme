# Test HelpMe questions in local Canvas

Use this guide to connect Canvas in Docker to HelpMe running with `yarn dev`.
The setup uses HTTP and the local name `helpme.test`:

- Open Canvas at `http://helpme.test`.
- Open HelpMe at `http://helpme.test:3100`.
- Keep HelpMe's existing development proxy on port `3000`. A forwarding process connects port `3100` to it.

Publish Canvas on port `80`, not `8080`. The local Canvas dynamic-registration URL can omit non-default ports.
If port `80` is already occupied, stop the conflicting service before following this guide.

Keep `NODE_ENV=development`. You do not need Portless or HTTPS certificates for this workflow.

## Prepare the applications

1. Follow [the HelpMe development guide](DEVELOPING.md#installation-to-run-locally) to install dependencies and create the environment files.
2. Install Docker using [Docker's installation instructions](https://docs.docker.com/get-started/get-docker/).
3. Clone the [official Canvas repository](https://github.com/instructure/canvas-lms) into a separate directory from HelpMe:

   ```sh
   git clone https://github.com/instructure/canvas-lms.git
   cd canvas-lms
   ```

4. Follow [Canvas's Docker setup guide](https://github.com/instructure/canvas-lms/blob/master/doc/docker/README.md). Complete its prerequisites, run `./script/docker_dev_setup.sh`, and follow the script's **Next Steps** output. Cloning the repository alone does not install or start Canvas.
5. Create a local Canvas administrator account and a test course. Keep the course ID from its URL, such as `/courses/4`.
6. Start HelpMe's database services with `yarn dev:db:up` from the HelpMe checkout.
7. Start the separate chatbot backend if you need to test generated feedback. `yarn dev` does not start that backend.

The commands below assume that Canvas uses Compose services named `web` and `jobs`.
Run Canvas Compose commands from the Canvas checkout. Run HelpMe commands from the HelpMe checkout.
On Windows, keep HelpMe and Docker Desktop in the same development environment. A separate WSL networking layer requires additional connectivity checks.

## 1. Let the browser and Canvas reach HelpMe

### Add the name on your computer

Open your hosts file with administrator privileges:

- macOS and Linux: `/etc/hosts`.
- Windows: `C:\Windows\System32\drivers\etc\hosts`. Open your text editor as Administrator.

Add this line once:

```text
127.0.0.1 helpme.test
```

Do not replace the existing localhost entries. This entry makes your browser resolve `helpme.test` to your computer.

### Add the name inside Docker

Merge these settings into the existing services in Canvas's `docker-compose.override.yml`:

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

### Set HelpMe's public address

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

In `packages/frontend/next.config.mjs`, add `helpme.test` to `allowedDevOrigins` and `helpme.test:3100` to `experimental.serverActions.allowedOrigins`.
Preserve the existing entries. These local development settings allow the browser to use the custom address.

Start the existing development command with an explicit frontend port:

```sh
yarn cross-env PORT=3001 yarn dev
```

Check its startup output. The frontend must use `3001`, the API must use `3002`, and the development proxy must use `3000`.
`cross-env` sets the frontend port with the same command on Windows, macOS, and Linux.

In another terminal, start the forwarder:

```sh
node -e 'const net=require("net"); net.createServer(client=>{const upstream=net.connect(3000,"127.0.0.1"); client.pipe(upstream).pipe(client); client.on("error",()=>upstream.destroy()); upstream.on("error",()=>client.destroy())}).listen(3100,"0.0.0.0",()=>console.log("Forwarding :3100 -> :3000"))'
```

Expect `Forwarding :3100 -> :3000`. Leave this terminal open while you test.
The forwarder accepts connections from Docker. It does not register HelpMe or configure hostnames.

Open `http://helpme.test:3100` in your browser. Then check the connection from Canvas:

```sh
docker compose exec web curl --fail --show-error http://helpme.test:3100/api/v1/lti/keys
```

Expect a JSON document containing a `keys` array. Fix connection errors before you continue to registration.
If your container has no `curl`, run this equivalent check:

```sh
docker compose exec web ruby -rnet/http -e 'r=Net::HTTP.get_response(URI("http://helpme.test:3100/api/v1/lti/keys")); abort("HTTP #{r.code}") unless r.is_a?(Net::HTTPSuccess); puts r.body'
```

## 2. Register HelpMe in Canvas

Use your local Canvas administrator account for these steps. Do not change a production registration.

1. Open the account's app registration screen and choose **Dynamic Registration**. The screen location depends on your Canvas version and enabled features.
2. Enter `http://helpme.test:3100/api/v1/lti/register` as the **Dynamic Registration URL**.
3. Complete the registration with the name `HelpMe`. Enable the registration if Canvas leaves it disabled.
4. Copy the client ID Canvas assigns to this registration.
5. Install the registered app in your test account or course. If the installation form offers **By Client ID**, enter the client ID you copied.
6. Make the app available. Open **Admin**, **Apps**, **Manage**, open HelpMe, open **Availability and Exceptions**, and make it available for the account or add an exception for your test course. Save and reload the course. A course cannot use an unavailable deployment.

Dynamic registration exchanges the signing-key URLs and launch URLs between Canvas and HelpMe. You do not need to generate or paste private signing keys.

Check that the registered HelpMe URLs use these addresses:

- Login initiation: `http://helpme.test:3100/api/v1/lti/login`.
- Launch redirect: `http://helpme.test:3100/api/v1/lti`.
- Signing keys: `http://helpme.test:3100/api/v1/lti/keys`.

If you already have a working registration under another hostname, keep that setup or update the registration consistently before using this guide's addresses.
Changing the browser address alone does not update either application's stored registration.
If dynamic registration is unavailable in your Canvas version, stop here and ask the maintainer which registration method that version supports.

## 3. Configure which Canvas HelpMe trusts

Use your own local identifier. Do not copy another developer's value or a production value.

Use the client ID from the Canvas registration screen. It is the LTI client ID, not the developer key's internal database row ID.

Add the value to `packages/server/.env`:

```dotenv
LTI_CANVAS_CLIENT_ID=<client ID from the registration screen>
```

Replace the entire placeholder, including angle brackets.

Stop and restart `yarn cross-env PORT=3001 yarn dev`. Keep the forwarding process running.
A missing client ID blocks launches. A mismatched client ID returns `403`.

## Test the embedded question

1. Map the local Canvas course to a HelpMe course through HelpMe's LMS integration settings.
2. Link the Canvas instructor identity to a HelpMe account with staff access to that course through the normal Canvas app launch.
3. Configure the chatbot connection for the course. Create an embeddable question in HelpMe and set its grading settings (rubric, score scale, automatic checks).
4. Open the Canvas content editor. Use the HelpMe editor button to select and insert the question.
5. Save the content. Open it with a local student account and submit a response.

Expect feedback inside Canvas. An instructor preview exercises staff authorization, so use a student account to check the learner flow.

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
- **Launch returns 403:** Check the client ID and restart HelpMe. Staff also need a linked identity and course access.
- **Launch works but feedback fails:** Check the chatbot backend and the question's grading settings.
- **Old hostname appears after a redirect:** Update the existing app registration and HelpMe environment settings consistently. Reinsert saved Canvas links that contain the old hostname.

This HTTP setup uses the same hostname on different ports. It does not verify production HTTPS behavior or isolation between host-only cookies on separate hostnames.
