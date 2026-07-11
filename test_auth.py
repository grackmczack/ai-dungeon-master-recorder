import urllib.request, json

api_key = 'sk-rfjzfdriopjqnxryejndlobamhwhhzxvagtslihcxjjbbjnu'

body = json.dumps({
    'model': 'deepseek-ai/DeepSeek-V3',
    'messages': [{'role': 'user', 'content': 'Say hello'}],
    'max_tokens': 10
}).encode()

# Also try the API key endpoint to verify key status
for url, method in [
    ('https://api.siliconflow.cn/v1/user/info', 'GET'),
    ('https://api.siliconflow.cn/v1/chat/completions', 'POST'),
]:
    try:
        req = urllib.request.Request(
            url,
            data=body if method == 'POST' else None,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        )
        req.get_method = lambda m=method: m
        resp = urllib.request.urlopen(req, timeout=15)
        print(f'{method} {url} => {resp.status}: {resp.read().decode()[:300]}')
    except urllib.error.HTTPError as e:
        print(f'{method} {url} => {e.code}: {e.read().decode()[:200]}')
    except Exception as e:
        print(f'{method} {url} => ERROR: {e}')