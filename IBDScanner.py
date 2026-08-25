import requests
import json
import os

email = os.getenv("EMAIL")
barcode = "016000144811" #hard coded
fields = "product_name,brands,ingredients,ingredients_tags,ingredients_text_en,additives_tags,allergens_tags,labels_tags,categories_tags,ingredients_analysis_tags,nutriments,nutrient_levels,nova_group,completeness"
url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields={fields}"
headers = {
        "User-Agent": "IBDScanner/0.1 - {email}}"
}
try:
    urlresponse = requests.get(url, headers=headers, timeout=10)
    data = urlresponse.json()
except requests.exceptions.Timeout:
    print("server took too long to respond!")
except requests.exceptions.RequestException as error:
    print(f"Request failed: {error}")
else: 
    if urlresponse.status_code != 200:
        print(f"bad response: {urlresponse.status_code}")
    elif data["status"] == 0:
        print("Product does not exist")
    else:
        print(data["product"]["product_name"])
        # print(data["product"].keys())

def getLeaves(ingredientList):
    leaves=[]
    for ingredient in ingredientList:
        if "ingredients" in ingredient: #go through the ingredient list and find if there are underlying ingredients, recurse to get leaves of those ingredients
            childLeaves = getLeaves(ingredient["ingredients"])
            leaves.extend(childLeaves)
        else:
            leaves.append(ingredient)
    return leaves

print(getLeaves(data["product"]["ingredients"]))
