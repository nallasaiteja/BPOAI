import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merugu_bpo.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from leads.models import Lead, ImportBatch, LeadMappingTemplate

User = get_user_model()
admin_user = User.objects.filter(username='admin').first()
if not admin_user:
    admin_user = User.objects.create_superuser('admin', 'admin@merugu.com', 'adminpassword123')

client = APIClient()
client.force_authenticate(user=admin_user)

xlsx_path = r'C:/Users/Mohan/.gemini/antigravity/brain/f6b1f1db-b166-4593-a24b-b17d5d2698a0/.user_uploaded/media_1793639667476_2c9d806d.xlsx'

print('--- TEST 1: Inspect Book2.xlsx ---')
with open(xlsx_path, 'rb') as f:
    resp = client.post('/api/v1/leads/inspect-file/', {'file': f}, format='multipart')

assert resp.status_code == 200, f"Inspect failed: {resp.status_code} - {resp.data}"
data = resp.data
print(f"Status: {resp.status_code}")
print(f"Total Rows: {data.get('total_rows')}")
print(f"Has Headers: {data.get('has_headers')}")
print(f"Header Confidence: {data.get('header_confidence')}%")
print(f"Header Reasons: {data.get('header_reasons')}")
print("Detected Columns:")
for col in data.get('columns', []):
    print(f"  Col {col['col_letter']} ('{col['original_col']}') -> '{col['suggested_field']}' ({col['confidence']}%) - {col['reason']}")

file_token = data.get('file_token')
mappings = {c['original_col']: c['suggested_field'] for c in data.get('columns', [])}

print('\n--- TEST 2: Preview Mapping ---')
prev_resp = client.post('/api/v1/leads/preview-mapping/', {
    'file_token': file_token,
    'mappings': mappings,
    'has_headers': data.get('has_headers', False)
}, format='json')

assert prev_resp.status_code == 200, f"Preview failed: {prev_resp.status_code} - {prev_resp.data}"
prev_data = prev_resp.data
print(f"Preview Status: {prev_resp.status_code}")
print(f"Counts: Total={prev_data.get('total_rows')} | Valid={prev_data.get('valid_count')} | Duplicate={prev_data.get('duplicate_count')} | Invalid={prev_data.get('invalid_count')}")
print("First 2 Sample Mapped Rows:")
for r in prev_data.get('sample_rows', [])[:2]:
    print(f"  Row {r['row_num']}: {r['status']} -> {r['normalized_data']}")

print('\n--- TEST 3: Commit Import ---')
commit_resp = client.post('/api/v1/leads/commit-import/', {
    'file_token': file_token,
    'mappings': mappings,
    'has_headers': data.get('has_headers', False),
    'save_template_name': 'Zysk Format Template'
}, format='json')

assert commit_resp.status_code in (200, 201), f"Commit failed: {commit_resp.status_code} - {commit_resp.data}"
commit_data = commit_resp.data
print(f"Commit Status: {commit_resp.status_code}")
print(f"Batch Number: {commit_data.get('batch_number')}")
print(f"Imported Count: {commit_data.get('imported_count')}")
print(f"Duplicate Count: {commit_data.get('duplicate_count')}")
print(f"Summary: {commit_data.get('summary_message')}")

# Verify Lead in DB
imported_leads = Lead.objects.filter(import_batch__id=commit_data.get('batch_id'))
print(f"Leads verified in DB for this batch: {imported_leads.count()}")
sample_lead = imported_leads.first()
if sample_lead:
    print(f"Sample DB Lead: Company='{sample_lead.company_name}', Email='{sample_lead.business_email}', Designation='{sample_lead.designation}', Phone='{sample_lead.contact_number}', Code='{sample_lead.lead_code}', Status='{sample_lead.lead_status}'")

# Verify Template in DB
tmpl = LeadMappingTemplate.objects.filter(name='Zysk Format Template').first()
print(f"Saved Template Verified: '{tmpl.name}' with mappings {tmpl.mappings if tmpl else 'None'}")

# Clean up test script
print('\n--- TEST 4: Delete All & Rejection Report ---')
batch = ImportBatch.objects.first()
if batch:
    rep_resp = client.get(f'/api/v1/leads/rejection-report/?batch_id={batch.id}')
    assert rep_resp.status_code == 200, f"Rejection report failed: {rep_resp.status_code}"
    csv_content = rep_resp.content.decode('utf-8')
    print("Rejection Report Header & First 2 rows:")
    for line in csv_content.splitlines()[:3]:
        print(" ", line)

del_resp = client.post('/api/v1/leads/delete_all/')
assert del_resp.status_code == 200
print("Delete all verified: DB leads remaining:", Lead.objects.count())

print('\nALL DIRECT INTEGRATION TESTS PASSED!')
