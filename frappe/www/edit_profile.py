import frappe
from frappe import _
import frappe.www.list


def get_context(context):
	user = frappe.form_dict['user']
	context.user_account = frappe.get_doc('User', {'name': user}, fields = ['full_name', 'banner_image', 'image'])
	context.show_sidebar=True
	context.add_breadcrumbs = True
	context.parents = [dict(route='/me', label='My Account')]
	context.languages = frappe.get_all('Language', pluck = 'name')
	