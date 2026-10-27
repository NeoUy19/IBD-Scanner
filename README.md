# IBD Scanner

Looks up a packaged food by barcode and flags ingredients **commonly reported as
triggers** for people with inflammatory bowel disease (IBD). It flags known
common irritants. It does not predict how any one person will react, since IBD
triggers vary a lot between people.

Data comes from [Open Food Facts](https://world.openfoodfacts.org/), a free,
crowd-sourced food label database.

## Tech stack

- **Backend:** Python 3.13 with `requests`, rules stored as JSON
- **Hosting:** AWS Lambda (serverless)
- **API:** AWS API Gateway (REST API, API-key auth, usage-plan rate limiting)
- **Frontend:** React + TypeScript, built with Vite; camera scanning with
  `html5-qrcode`
- **Data:** Open Food Facts API

## Status

| Step |                                         |                    |
| ---- | --------------------------------------- | ------------------ |
| 1    | Test the Open Food Facts API by hand    | Done               |
| 2    | Python script: trigger rules + matching | Done (v1)          |
| 3    | Deploy as an AWS Lambda function        | Done               |
| 4    | API Gateway in front, with an API key   | Done               |
| 5    | DynamoDB cache                          | Planned (optional) |
| 6    | Frontend (typed barcode + camera scan)  | Done (v0.2.5)      |

## How it works

1. `getProduct(barcode)` fetches the product from Open Food Facts.
2. For each trigger in `rules.json`, the matching code checks three sources, from
   most to least reliable: additive tags, ingredient IDs, then the raw
   ingredient text.
3. Fat is checked separately against numeric thresholds.
4. `scan(barcode)` returns everything as a dict. `lambda_handler` wraps that
   for AWS.

Running locally:

```
python IBDScanner.py
```

## Frontend

The frontend in `frontend/` is a React + TypeScript app built with Vite. You
type a barcode or scan one with the camera, and it lists the triggers that
matched.

- `src/App.tsx`: the page, the API call and the results list
- `src/components/Scanner.tsx`: the camera scanner. It shows a portrait video
  with a guide box, ignores repeat reads, and turns green with "Scanning..."
  when it finds a barcode.

To run it, create `frontend/.env.local` (it's gitignored):

```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod/
VITE_API_KEY=<your API key>
```

Then:

```
cd frontend
npm install
npm run dev
```

and open the URL it prints. The camera works on `localhost`; other devices need
the site served over HTTPS.

The original plain HTML version (v0.1.0) is still in `ScannerFrontend/`.

## Releases

| Version | What changed |
| ------- | ------------ |
| v0.2.5  | Scanner page: portrait camera view, guide box, "detected" visual |
| v0.2.0  | React + TypeScript frontend with camera scanning |
| v0.1.0  | Lambda + API Gateway backend, plain HTML frontend |

## Future work

- DynamoDB cache for repeat lookups
- Deploy the frontend over HTTPS so the camera works on phones
- Product popup with image and full ingredient list
- Fewer false positives: negative terms (peanut butter, coconut milk),
  label/category suppression (strained oat milk), reduced severity for
  low-lactose dairy
- "Unknown" result when Open Food Facts failed to parse the ingredients
- Separate 404 (not found) from 502 (Open Food Facts down)
- Test set using known barcodes
- Recommend healthier alternatives

---

# What I'm learning

Notes on the concepts behind each part of the project.

## APIs and HTTP

**API (Application Programming Interface):** a way for one program to ask
another for data or actions. Here my script asks Open Food Facts for product
data.

**HTTP request:** a message sent to a URL. It has a **method** (e.g. `GET` =
"give me something"), **headers** (extra info about the request) and,
sometimes, a body. The server replies with a **status code** and a body.

- `200` = OK, `403` = forbidden, `404` = not found, `500` = server error
- Open Food Facts returns `403` unless I send a `User-Agent` header saying who
  I am. Many public APIs require this so they know who is calling.
- A `200` response can still mean "not found." Open Food Facts uses its own
  `status: 0` inside the body for that, so I have to check both.

**JSON:** the text format APIs use to send data. It maps directly onto Python
dicts and lists. `json.load` reads JSON into Python, and `json.dumps` turns
Python into a JSON string.

## REST APIs

**REST** is a common style for designing web APIs. The main ideas:

- **Everything is a resource with a URL.** A product is
  `/product/3017624010701`. My scanner will be `/scan/3017624010701`.
- **The HTTP method says what to do with it.** `GET` reads, `POST` creates,
  `PUT` updates, `DELETE` removes.
- **Stateless:** each request contains everything the server needs. The server
  doesn't remember earlier requests from the same client.
- **Responses are usually JSON** and use standard status codes.

So a REST API is a set of URLs that a program (like my future frontend) can call
over HTTP to get or change data, following those conventions.

**Path parameters:** the variable part of a URL. In `/scan/{barcode}`,
`barcode` is a path parameter, and API Gateway passes it to my Lambda as
`event["pathParameters"]["barcode"]`.

## Working with messy data

- **Never treat missing data as "no."** An empty list can mean "nothing found"
  or "the parser failed." For a health tool, saying "clear" when the real
  answer is "unknown" is the dangerous mistake.
- **Recursion:** ingredients nest inside other ingredients (a chocolate filling
  contains milk). A function that calls itself on each sub-list (`getLeaves`)
  flattens any depth of nesting.
- **`.get()` with defaults:** `d.get("key", [])` returns a default instead of
  crashing when a field is missing, which happens a lot with crowd-sourced
  data.
- **Data vs. logic:** the trigger lists live in `rules.json`, not in the code.
  Adding a new E-number trigger means editing data, not rewriting functions.

## Python structure

- **Return values instead of printing:** `scan()` returns a dict instead of
  printing results, so the same function can be used from the terminal, from
  Lambda or from a web server.
- **`if __name__ == "__main__":`** runs code only when the file is started
  directly, not when it's imported. Lambda _imports_ my file, so `input()` has
  to sit behind this check or the function would hang.
- **Environment variables** (`os.getenv("EMAIL")`) keep personal or secret
  values out of the code and out of Git. They're set on my machine locally and
  in the Lambda configuration on AWS.

## Cloud / AWS

**Serverless / AWS Lambda:** I upload a function, and AWS runs it only when it's
called. I don't manage a server, and I pay only per call.

- **Handler:** the entry point AWS calls, `lambda_handler(event, context)`.
  `event` holds the request data. The handler setting
  `IBDScanner.lambda_handler` means "file `IBDScanner.py`, function
  `lambda_handler`".
- **No global state between requests:** Lambda reuses the same running
  environment for later calls, so anything stored in module-level variables
  can leak from one request into the next. Read-only data like the rules is
  fine.
- **Deployment package:** Lambda doesn't include third-party libraries like
  `requests`, so I zip them together with my code.
- **Platform-specific packages:** some libraries contain compiled code built
  for one operating system and Python version. Lambda runs Linux, so I install
  with `--platform manylinux2014_x86_64 --python-version 3.13` to get the
  versions Lambda can load, not the Mac ones.
- **Case-sensitive filenames:** macOS treats `rules.JSON` and `rules.json` as
  the same file, but Linux doesn't. That's why the file was renamed.

**API Gateway:** the AWS service that gives my Lambda a public URL. It receives
HTTP requests, turns them into an `event`, calls the Lambda and turns the
returned `{"statusCode": ..., "body": ...}` back into an HTTP response.

- **Lambda proxy integration:** passes the whole request through to the
  Lambda, which is how `pathParameters` gets filled in.
- **API key + usage plan:** callers must send a secret key in a header, and
  the usage plan limits how often they can call. This keeps the API private and
  protects against surprise costs. (These are only available on the REST API
  type, not the HTTP API type.)

## Frontend (JavaScript)

- **The DOM:** the page as objects JavaScript can change.
  `document.getElementById("results")` finds an element, and `.textContent`
  sets its text.
- **Event listeners:** `addEventListener("click", function)` runs code when
  the button is clicked. Anything that reads the input has to be *inside* that
  function, or it only runs once, when the page loads and the box is empty.
- **`fetch` + `async`/`await`:** `fetch` sends the HTTP request, and `await`
  waits for the reply. `response.json()` turns the body into an object, like
  `json.loads` in Python.
- **CORS:** browsers block a page from reading responses from another domain
  unless the server allows it. My Lambda sends
  `Access-Control-Allow-Origin: *` to allow it.
- **Frontend keys aren't secret:** `config.js` keeps the API key out of Git,
  but anyone using the page can see it in dev tools. The usage plan limits the
  damage.


## Frontend (React + TypeScript)

- **`.tsx`** is TypeScript plus JSX. Types are checked in the editor and by
  `npm run build`, then erased; the browser only runs plain JavaScript.
- **JSX rules:** `className` instead of `class`, every tag closes (`<input />`),
  one parent element per `return` (a fragment `<> </>` works), and attributes
  set from JavaScript use `{ }` instead of quotes.
- **`useState`** holds values that change. Calling the setter (`setLines(...)`)
  re-renders the page, which replaces `getElementById` + `textContent`.
- **Controlled input:** `value={barcode}` + `onChange` keep the box and the
  state in sync. `<form onSubmit>` + `preventDefault()` lets Enter submit
  without reloading the page.
- **Conditional rendering:** `{error && <p>...</p>}` and the ternary
  `{detected ? "Scanning..." : "Line up..."}`. A ternary inside `className`
  switches classes on and off.
- **Components and props:** `Scanner` gets an `onScan` callback, so it doesn't
  need to know what happens with the barcode.
- **`useEffect`** runs after the component appears. Its cleanup function stops
  the camera when the scanner closes. In development, StrictMode runs effects
  twice to catch missing cleanup.
- **A plain `let` vs state:** the `done` guard is a `let`, because it doesn't
  change what's on screen; it only remembers that a barcode was already read.
- **`id` vs `className`:** an id is unique (html5-qrcode finds `#reader` by
  id); classes are shared style labels, and an element can have several.
- **Vite env variables:** only `VITE_` variables from `.env.local` reach the
  browser. Restart `npm run dev` after changing them.
