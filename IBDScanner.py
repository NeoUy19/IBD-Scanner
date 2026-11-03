import requests
import json
import os

with open ("rules.json") as f:
    rules = json.load(f)
email = os.getenv("EMAIL")
# TODO (product image): add image_front_small_url to this list
# (image_front_url is the full-size version).
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
                # TODO (product image): also return "name" (product_name),
                # "brand" (brands) and "image" (image_front_small_url).
                # Use .get() with defaults — many products have no photo.
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
        # TODO (product image): change the JSON shape so product info and rule
        # results are kept apart:
        #   {"product": {"name": ..., "brand": ..., "image": ...},
        #    "flags": {"lactose": {...}, "fat": {...}, ...}}
        # Build the rule results in a "flags" dict, then return both.
        # The frontend's types and toLines must change to match (see App.tsx).
        returnDict = {}
        for ruleName in rules:
            addMatches = checkRule(ruleName, product["additives"])
            leafMatches = checkRule(ruleName, product["leafIds"])
            tagMatches = checkRule(ruleName, product["tags"])
            textMatches = checkText(ruleName, product["ingredients"])
            # TODO (explanations): every rule in rules.json already has "name"
            # and "explanation" (and "evidence"). Add them to this dict, e.g.
            # "name": rules[ruleName]["name"] — use .get() with a default in
            # case a rule is missing one. The frontend can then show *why*.
            returnDict[ruleName] = {
                "additive": addMatches,
                "leaves": leafMatches,
                "tags": tagMatches,
                "ingredients": textMatches
            }
        fatMatches = checkFats(product["nutriments"])
        # TODO (explanations): fat's explanation lives under rules["high_fat"].
        # Add it to the dict below too (the "Unknown" case can stay a string,
        # or become a dict with a "status" key — your choice, but update the
        # FatResult type in App.tsx to match).
        if ("fat_100g" not in product["nutriments"]):
            returnDict["fat"] = "Unknown"
        elif fatMatches:
            returnDict["fat"] = {"fat values": fatMatches}
        # TODO (deploy): the explanations only reach the site after you paste
        # this file into the Lambda console and click Deploy.
    else:
        return {"error": "Product not found"}
    return returnDict
def lambda_handler(event,context):
    params = event.get("pathParameters") or {}
    result = scan(params.get("barcode"))
    status = 200
    if "error" in result:
        status = 404
    return{
        "statusCode": status,
        "body": json.dumps(result),
        "headers": {
            "Access-Control-Allow-Origin": "*"
        }
    }
    
if __name__ == "__main__":
    barcode = input("Enter barcode: ")
    print(scan(barcode))



