frappe.provide('frappe.energy_points');

frappe.pages['user-profile'].on_page_load = function(wrapper) {

	let page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("User Profile"),
	});

	let user_profile = new UserProfile(wrapper)
	$(wrapper).bind('show',()=> {
		user_profile.show();
	});
}

class UserProfile {

	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.sidebar = this.wrapper.find(".layout-side-section");
		this.main_section = this.wrapper.find(".layout-main-section");
	}

	show() {
		this.route = frappe.get_route();
		//validate if user
		if (this.route.length > 1) {
			let user_id = this.route.slice(-1)[0];
			this.check_user_exists(user_id);
		} else {
			this.user_id = frappe.session.user;
			this.make_user_profile();
		}
	}

	check_user_exists(user) {
		frappe.db.exists('User', user).then( exists => {
			if(!exists) {
				frappe.msgprint('User does not exist');
			} else {
				this.user_id = user;
				this.make_user_profile();
			}
		});
	}

	make_user_profile() {
		frappe.set_route('user-profile', this.user_id);
		this.user = frappe.user_info(this.user_id);
		this.page.set_title(this.user.fullname);
		this.setup_user_search();
		this.main_section.empty().append(frappe.render_template('user_profile'));
		this.energy_points = 0;
		this.rank = 0;
		this.month_rank = 0;
		this.render_user_details();
		this.render_points_and_rank();
		this.render_heatmap();
		this.render_line_chart();
		this.render_percentage_chart('type', 'Type Distribution');
		this.create_percentage_chart_filters();
		this.setup_show_more_activity();
		this.render_user_activity();
	}

	setup_user_search() {
		var me = this;
		this.$user_search_button = this.page.set_secondary_action('Change User', function() {
			me.show_user_search_dialog()
		});
	}

	show_user_search_dialog() {
		let dialog = new frappe.ui.Dialog({
			title: __('Change User'),
			fields: [
				{
					fieldtype: 'Link',
					fieldname: 'user',
					options: 'User',
					label: __('User'),
				}
			],
			primary_action_label: __('Go'),
			primary_action: ({ user }) => {
				dialog.hide();
				this.check_user_exists(user);
			}
		});
		dialog.show();
	}

	render_heatmap() {
		this.heatmap = new frappe.Chart('.performance-heatmap', {
			type: 'heatmap',
			countLabel: 'Energy Points',
			data: {},
			discreteDomains: 0,
		});
		this.update_heatmap_data();
		this.create_heatmap_chart_filters();
	}

	update_heatmap_data(date_from) {
		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_heatmap_data', {
			user: this.user_id,
			date: date_from || frappe.datetime.year_start(),
		}).then((r) => {
			this.heatmap.update( {dataPoints: r} );
		});
	}

	get_years_since_creation() {
		//Get years since user account created
		this.user_creation = frappe.boot.user.creation;
		let creation_year = this.get_year(this.user_creation);
		let current_year = this.get_year(frappe.datetime.now_date());
		let years_list = [];
		for (var year = current_year; year >= creation_year; year--) {
			years_list.push(year);
		}
		return years_list;
	}

	get_year(date_str) {
		return date_str.substring(0, date_str.indexOf('-'));
	}

	render_line_chart() {
		this.line_chart_filters = {'user': this.user_id};
		this.line_chart_data = {
			timespan: 'Last Month',
			time_interval: 'Daily',
			type:'Line',
			value_based_on: "points",
			chart_type: "Sum",
			document_type: "Energy Point Log",
			name: 'Energy Points',
			width: 'half',
			based_on: 'creation'
		}

		this.line_chart = new frappe.Chart( ".performance-line-chart", {
			title: 'Energy Points',
			type: 'line',
			height: 200,
			data: {
				labels: [],
				datasets: [{}]
			},
			colors: ['purple'],
			axisOptions: {
				xIsSeries: 1
			}
		});
		this.update_line_chart_data();
		this.create_line_chart_filters();
	}

	update_line_chart_data() {
		this.line_chart_data.filters_json = JSON.stringify(this.line_chart_filters);

		frappe.xcall('frappe.desk.doctype.dashboard_chart.dashboard_chart.get', {
			chart: this.line_chart_data,
			no_cache: 1,
		}).then(chart => {
			this.line_chart.update(chart);
		});
	}

	render_percentage_chart(field, title) {
		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_pie_chart_data', {
			user: this.user_id,
			field: field
		}).then(chart => {
			if (chart.labels.length) {
				this.percentage_chart = new frappe.Chart( '.performance-percentage-chart', {
					title: title,
					type: 'percentage',
					data: {
						labels: chart.labels,
						datasets: chart.datasets
					},
					barOptions: {
						height: 11,
						depth: 1
					},
					height: 160,
					maxSlices: 8,
					colors: ['#5e64ff', '#743ee2', '#ff5858', '#ffa00a', '#feef72', '#28a745', '#98d85b', '#a9a7ac'],
				});
			} else {
				this.wrapper.find('.percentage-chart-container').hide();
			}
		});
	}

	create_line_chart_filters() {
		let filters = [
			{
				label: 'All',
				options: ['All', 'Auto', 'Criticism', 'Appreciation', 'Revert'],
				action: (selected_item) => {
					if (selected_item === 'All') delete this.line_chart_filters.type;
					else this.line_chart_filters.type = selected_item;
					this.update_line_chart_data();
				}
			},
			{
				label: 'Last Month',
				options: ['Last Week', 'Last Month', 'Last Quarter'],
				action: (selected_item) => {
					this.line_chart_data.timespan = selected_item;
					this.update_line_chart_data();
				}
			},
			{
				label: 'Daily',
				options: ['Daily', 'Weekly', 'Monthly'],
				action: (selected_item) => {
					this.line_chart_data.time_interval = selected_item;
					this.update_line_chart_data();
				}
			},
		]
		this.render_chart_filters(filters, '.line-chart-container');
	}

	create_percentage_chart_filters() {
		let filters = [
			{
				label: 'Type',
				options: ['Type', 'Reference Doctype', 'Rule'],
				fieldnames: ['type', 'reference_doctype', 'rule'],
				action: (selected_item, fieldname) => {
					let title = selected_item + ' Distribution';
					this.render_percentage_chart(fieldname, title);
				}
			},
		]
		this.render_chart_filters(filters, '.percentage-chart-container');
	}

	create_heatmap_chart_filters() {
		let filters = [
			{
				label: this.get_year(frappe.datetime.now_date()),
				options: this.get_years_since_creation(),
				action: (selected_item) => {
					this.update_heatmap_data(frappe.datetime.obj_to_str(selected_item));
				}
			},
		]
		this.render_chart_filters(filters, '.heatmap-container');
	}

	render_chart_filters(filters, container) {
		console.log(this.wrapper.find(container));
		filters.forEach(filter => {
			let chart_filter_html = `<div class="chart-filter pull-right">
				<a class="dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					<button class="btn btn-default btn-xs">
						<span class="filter-label">${filter.label}</span>
						<span class="caret"></span>
					</button>
				</a>`;
			let options_html;
			if (filter.fieldnames) {
				options_html = filter.options.map((option, i) =>
					`<li><a data-fieldname = "${filter.fieldnames[i]}">${option}</a></li>`).join('');
			} else {
				options_html = filter.options.map( option => `<li><a>${option}</a></li>`).join('');
			}
			let dropdown_html= chart_filter_html + `<ul class="dropdown-menu">${options_html}</ul></div>`;
			let $chart_filter = $(dropdown_html);
			$chart_filter.prependTo(this.wrapper.find(container));
			$chart_filter.find('.dropdown-menu').on('click', 'li a', (e)=> {
				let $el = $(e.currentTarget);
				let fieldname;
				if ($el.attr('data-fieldname')) {
					fieldname = $el.attr('data-fieldname');
				}
				let selected_item = $el.text();
				$el.parents('.chart-filter').find('.filter-label').text(selected_item);
				filter.action(selected_item, fieldname);
			})
		});

	}

	edit_profile() {
		let edit_profile_dialog = new frappe.ui.Dialog({
			title: __('Edit Profile'),
			fields: [
				{
					fieldtype: 'Attach Image',
					fieldname: 'user_image',
					label: 'Profile Image',
				},
				{
					fieldtype: 'Data',
					fieldname: 'interest',
					label: 'Interests',
				},
				{
					fieldtype: 'Column Break'
				},
				{
					fieldtype: 'Data',
					fieldname: 'location',
					label: 'Location',
				},
				{
					fieldtype: 'Section Break',
					fieldname: 'Interest',
				},
				{
					fieldtype: 'Small Text',
					fieldname: 'bio',
					label: 'Bio',
				}
			],
			primary_action: values => {
				edit_profile_dialog.disable_primary_action();
				frappe.xcall('frappe.desk.page.user_profile.user_profile.update_profile_info', {
						profile_info: values
					})
					.then(user => {
						user.image = user.user_image;
						this.user = Object.assign(values, user);
						edit_profile_dialog.hide();
						this.render_user_details();
					})
					.finally(() => {
						edit_profile_dialog.enable_primary_action();
					});
			},
			primary_action_label: __('Save')
		});

		edit_profile_dialog.set_values({
			user_image: this.user.image,
			location: this.user.location,
			interest: this.user.interest,
			bio: this.user.bio
		});
		edit_profile_dialog.show();
	}

	render_user_details() {
		this.sidebar.empty().append(frappe.render_template('user_profile_sidebar', {
			user_image: frappe.avatar(this.user_id,'avatar-frame', 'user_image', this.user.image),
			user_abbr: this.user.abbr,
			user_location: this.user.location,
			user_interest: this.user.interest,
			user_bio: this.user.bio,
		}));

		this.setup_user_profile_links();
	}

	setup_user_profile_links() {
		if (this.user_id !== frappe.session.user) {
			this.wrapper.find('.profile-links').hide();
		} else {
			this.wrapper.find(".edit-profile-link").on("click", () => {
				this.edit_profile();
			});

			this.wrapper.find(".user-settings-link").on("click", () => {
				this.go_to_user_settings();
			});
		}
	}

	get_user_energy_points_and_rank(date) {
		return frappe.xcall('frappe.desk.page.user_profile.user_profile.get_user_points_and_rank', {
			user: this.user_id,
			date: date || null,
		})
		.then(user => {
			if (user[0]) {
				let user_info = user[0];
				//Check if monthly rank or all time rank
				if (!this.energy_points) this.energy_points = user_info[1];
				if (!date) {
					this.rank = user_info[2];
				} else {
					this.month_rank = user_info[2];
				}
			}
		})
	}

	render_points_and_rank() {
		let $profile_details = this.wrapper.find('.profile-details');

		this.get_user_energy_points_and_rank().then(() => {
			let html = $(__(`<p class="user-energy-points text-muted">Energy Points: <span class="rank">{0}</span></p>
				<p class="user-energy-points text-muted">Rank: <span class="rank">{1}</span></p>`, [this.energy_points, this.rank]));
				$profile_details.append(html);

			this.get_user_energy_points_and_rank(frappe.datetime.month_start()).then(() => {
				let html = $(__(`<p class="user-energy-points text-muted">Monthly Rank: <span class="rank">{0}</span></p>`,
					[this.month_rank]));
				$profile_details.append(html);
			})
		})
	}

	go_to_user_settings() {
		frappe.set_route('Form', 'User', this.user_id);
	}

	render_user_activity(append_to_activity) {
		this.$recent_activity_list = this.wrapper.find('.recent-activity-list');

		let get_recent_energy_points_html = (field) => {
			let message_html = frappe.energy_points.format_history_log(field);
			return `<p class="recent-activity-item text-muted"> ${message_html} </p>`;
		}

		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_list', {
			start: this.activity_start,
			limit: this.activity_end,
			user: this.user_id
		}).then(list => {
			if(!list.length) {
				this.wrapper.find('.show-more-activity a').html('No More Activity');
			}
			let html = list.map(get_recent_energy_points_html).join('');
			if (append_to_activity) this.$recent_activity_list.append(html);
			else this.$recent_activity_list.html(html);
		})
	}

	setup_show_more_activity() {
		//Show 10 items at a time
		this.activity_start = 0;
		this.activity_end = 10;
		this.wrapper.find('.show-more-activity').on('click', () => this.show_more_activity());
	}

	show_more_activity() {
		this.activity_start = this.activity_end;
		this.activity_end += 10;
		this.render_user_activity(true);
	}

}



