import requests
import json
import os

email = os.getenv("EMAIL")
barcode = "0858847000284" #hard coded
url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
headers = {
        "User-Agent": "IBDScanner/0.1 - {email}}"
}
urlresponse = requests.get(url, headers=headers)
data = urlresponse.json()
print(data["product"]["product_name"])
print(urlresponse.status_code)