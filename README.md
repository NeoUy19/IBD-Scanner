# IBD Scanner

Looks up a packaged food by barcode and flags ingredients **commonly reported as
triggers** for people with inflammatory bowel disease (IBD). It flags known
common irritants. It does not predict how any one person will react, since IBD
triggers vary a lot between people.

Data comes from [Open Food Facts](https://world.openfoodfacts.org/), a free,
crowd-sourced food label database.

## Status

| Step |                                         |                    |
| ---- | --------------------------------------- | ------------------ |
| 1    | Test the Open Food Facts API by hand    | Done               |
| 2    | Python script: trigger rules + matching | Done (v1)          |
| 3    | Deploy as an AWS Lambda function        | Done               |
| 4    | API Gateway in front, with an API key   | In progress        |
| 5    | DynamoDB cache                          | Planned (optional) |
| 6    | Frontend (typed barcode, later webcam)  | Planned            |

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

## Git

- `.gitignore` keeps build output (`function.zip`, `package/`), the virtual
  environment and secrets out of the repo.
- `git mv` renames a file in a way Git tracks, which matters on macOS where a
  plain case-only rename can go unnoticed.
