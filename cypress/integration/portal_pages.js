context('Portal Pages', () => {
	beforeEach(() => {
		cy.login();
		cy.visit('/me');
	});

	it('contains "My Account" in the title', function () {
		cy.title().should('contain', 'My Account');
	});

	describe('with a 320x568 viewport', function () {
		beforeEach(function () {
			cy.viewport(320, 568);
		});

		it('mobile icons should be visible', function () {
			cy.get('.right-icon').should('be.visible');
		});
	});

	describe('contains indicator', function() {
		beforeEach(function () {
			cy.visit('/orders');
		});		
		
		it('should container indicator pill', function() {
			cy.get('.indicator-pill').should('be.visible');

		})

		it('should redirect to preview', function() {
			cy.get('.transaction-item-link').first().click()
		})
	});

});