curl -s 'https://www.wemakemarin.com/api/db/customers?limit=1' | jq .
curl -s 'https://www.wemakemarin.com/api/db/invoices?limit=1' | jq .
curl -s 'https://www.wemakemarin.com/api/db/items?limit=1' | jq .

curl -s 'https://www.wemakemarin.com/api/time/status?employee=Jane%20Smith' | jq .
# curl -s -XPOST 'https://www.wemakemarin.com/api/time/punch' \
#   -H 'content-type: application/json' \
#   -d '{"employee":"Jane Smith","action":"in"}' | jq .

