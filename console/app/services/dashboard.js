// app/services/dashboard.js
import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import { action } from '@ember/object';

export default class DashboardService extends Service {
    @service store;
    @service fetch;
    @service notifications;

    @tracked dashboards = [];
    @tracked currentDashboard;
    @tracked isEditingDashboard = false;

    @task *loadDashboards() {
        try {
            this.dashboards = yield this.store.findAll('dashboard');

            if (this.dashboards.length > 0) {
                this.currentDashboard = this.dashboards.find((dashboard) => dashboard.is_default) || this.dashboards[0];

                if (this.currentDashboard?.widgets?.length === 0) {
                    this.onChangeEdit(true);
                }
            }
        } catch (error) {
            console.error('Error loading dashboards:', error);
        }
    }

    @task *selectDashboard(dashboard) {
        try {
            const response = yield this.fetch.post('dashboards/switch', { dashboard_uuid: dashboard.id });
            this.store.pushPayload(response);
            const selectedDashboardId = response.uuid;
            this.currentDashboard = this.store.peekRecord('dashboard', selectedDashboardId);

            if (this.currentDashboard?.widgets?.length === 0) {
                this.onChangeEdit(true);
            }
        } catch (error) {
            this.notifications.error(`Error switching dashboard: ${error}`);
        }
    }

    @task *createDashboard(name, options = {}) {
        try {
            const newDashboard = this.store.createRecord('dashboard', { name, is_default: true });
            const response = yield newDashboard.save();

            if (typeof options.successNotification === 'function') {
                this.notifications.success(options.successNotification(response));
            } else {
                this.notifications.success(options.successNotification || `${response.name} created.`);
            }

            const defaultDashboard = this.dashboards.find((dashboard) => dashboard.owner_uuid === 'system');
            console.log(this.dashboards, defaultDashboard);
            this.store.unloadRecord(defaultDashboard);
            this.selectDashboard.perform(response);
            this.isEditingDashboard = true;
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *deleteDashboard(dashboard, options = {}) {
        try {
            yield dashboard.destroyRecord();
            this.notifications.success(options.successNotification || `${dashboard.name} has been deleted.`);
            this.loadDashboards.perform();
        } catch (error) {
            this.notifications.serverError(error);
            if (options.onError) {
                options.onError(error, dashboard);
            }
        } finally {
            if (options.callback) {
                options.callback(this.currentDashboard);
            }
        }
    }

    @task *setCurrentDashboard(dashboard) {
        try {
            const response = yield this.fetch.post('dashboards/switch', { dashboard_uuid: dashboard.id });
            this.currentDashboard = response;
        } catch (error) {
            this.notifications.error(`Error setting current dashboard: ${error}`);
        }
    }

    @action onChangeEdit(state = true) {
        this.isEditingDashboard = state;
    }
}
