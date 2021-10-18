# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE

import frappe
from frappe import _
import frappe.www.list

no_cache = 1

def get_context(context):
	if frappe.session.user=='Guest':
		frappe.throw(_("You need to be logged in to access this page"), frappe.PermissionError)
	
	
	context.show_sidebar=True
	context.users = frappe.get_doc('User', {'name': frappe.session.user}, fields = ['full_name', 'banner_image', 'image'])
	context.no_breadcrumbs = False