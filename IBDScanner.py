import requests
import json
import os

with open ("rules.json") as f:
    rules = json.load(f)
email = os.getenv("EMAIL")
fields = "product_name,brands,ingredients,ingredients_tags,ingredients_text_en,additives_tags,allergens_tags,labels_tags,categories_tags,ingredients_analysis_tags,nutriments,nutrient_levels,nova_group,completeness"
headers = {
        "User-Agent": f"IBDScanner/0.1 - {email}"
}

def getProduct(barcode):
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields={fields}"
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
            leaves = getLeaves(data["product"].get("ingredients", []))
            leafIds = []
            for leaf in leaves:
                leafIds.append(leaf.get("id"))
            return {
                "additives": data["product"].get("additives_tags", []),
                "tags": data["product"].get("ingredients_tags", []),
                "leaves": leaves,
                "leafIds": leafIds,
                "ingredients": data["product"].get("ingredients_text_en", "").lower(),
                "nutriments": data["product"].get("nutriments", {})
            }

def getLeaves(ingredientList):
    leaves=[]
    for ingredient in ingredientList:
        if "ingredients" in ingredient: #go through the ingredient list and find if there are underlying ingredients, recurse to get leaves of those ingredients
            childLeaves = getLeaves(ingredient["ingredients"])
            leaves.extend(childLeaves)
        else:
            leaves.append(ingredient)
    return leaves

def checkRule(ruleName,tagList):
    ruleCodes = rules[ruleName].get("e_numbers", []) + rules[ruleName].get("ingredient_ids", [])
    matches = []
    for tag in tagList:
        if tag in ruleCodes:
            matches.append(tag)
    return matches
def checkText(ruleName,text):
    terms = rules[ruleName].get("text_terms", [])
    validTerms = []
    for term in terms:
        if term in text:
            validTerms.append(term)
    return validTerms
def checkFats(nutriments):
    fats = rules["high_fat"]["thresholds"]
    matches = []
    for key, limit in fats.items():
        value = nutriments.get(key)
        if (value is not None and value >=limit):
            matches.append(f"{key}: {value}")
    return matches
def hasData(product):
    if (not product["ingredients"]  and not product["leaves"]):
        return False
    else:
        return True
#Start the main loop
def scan(barcode):
    product = getProduct(barcode)
    if product:
        if (not hasData(product) ):
            return {"error": "Not enough ingredient data" }
        returnDict = {}
        for ruleName in rules:
            addMatches = checkRule(ruleName, product["additives"])
            leafMatches = checkRule(ruleName, product["leafIds"])
            tagMatches = checkRule(ruleName, product["tags"])
            textMatches = checkText(ruleName, product["ingredients"])
            returnDict[ruleName] = {
                "additive": addMatches,
                "leaves": leafMatches,
                "tags": tagMatches,
                "ingredients": textMatches
            }
        fatMatches = checkFats(product["nutriments"])
        if ("fat_100g" not in product["nutriments"]):
            returnDict["fat"] = "Unknown"
        elif fatMatches:
            returnDict["fat"] = {"fat values": fatMatches}
    else:
        return {"error": "Product not found"}
    return returnDict
def lambda_handler(event,context):
    params = event.get("pathParameters") or {}
    result = scan(params.get("barcode"))
    return{"statusCode":200, "body": json.dumps(result)}
    
if __name__ == "__main__":
    barcode = input("Enter barcode: ")
    print(scan(barcode))



