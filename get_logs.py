import boto3
import json

client = boto3.client('logs', region_name='ap-southeast-1')
response = client.get_log_events(
    logGroupName='/aws/lambda/smart-campus-api',
    logStreamName='2026/08/05/[$LATEST]3e71e17679e44594be0fce7fe282c679',
    limit=50
)
with open('logs.txt', 'w', encoding='utf-8') as f:
    for event in response['events']:
        f.write(event['message'] + '\n')
