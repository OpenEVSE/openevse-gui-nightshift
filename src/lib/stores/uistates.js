import { writable, derived, get } from 'svelte/store'

const model = {
		// copy from other stores
		charge_current: undefined,
		shaper: undefined,
		autorelease: true,
		time_lmt: 0,
		charge_lmt: 0,
		config_version: 0,
		claims_version: 0,
		override_version: 0,
		schedule_version: 0,
		schedule_plan_version: 0,
		limit_version: 0,
		logidx_min: 0,
		logidx_max: 0,
		// (todo) derived from other stores
		mode: undefined, // 0:Auto 1:On 2:Off
		charging: false,
		stateclaimfrom: null, // "manual", "timer", "divert", "shaper", "ocpp", "mqtt", "rfid"
		time_localestring: null,
		error: false,
		error_desc: "",
		// local states
		data_loaded: false,
		ws_connected: true,
		ws_last_seen: 0, // unix secs of last successful WS contact; 0 = never
		ws_retry_request: 0, // nonce; bump to force an immediate WS reconnect
		ws_debug: {
			// diagnostics surfaced in the disconnect overlay's details panel
			attempts: 0, // reconnect attempts since the last successful open
			ever_connected: false, // did the socket ever reach OPEN this session
			close_code: null, // last CloseEvent.code (1006 = abnormal, no frame)
			close_reason: '', // last CloseEvent.reason (usually empty)
			retry_delay_ms: 0, // backoff before the pending retry
		},
		status_expanded: false,
		breakpoint: undefined,
		has_fetched: false,
		wizard_step: 0,
		vehicle_state_update: 0,
		divert_update: 0,
		rfid_waiting: 0,
		elapsed:0,
		alertbox: {
			title: undefined,
			body: undefined,
			visible: false,
			button: false,
			closable: true,
			component: undefined,
			action: ()=>{},
		},
		networks: []
}

function createUIStatesStore() {
    const P  = writable(model)
    const { subscribe, set, update } = P

	function resetAlertBox() {
		let states = get(P)
		states.alertbox = {
			title: undefined,
			body: undefined,
			visible: false,
			button: false,
			closable: true,
			component: undefined,
			action: ()=>{},
		}
		P.update(() => states)
	}
	function setObject(obj, data) {
		//write nested object
		let states = get(P)
		states[obj] = data
		P.update(()=> states)
	}
	
    return {
        subscribe,
        set,
		resetAlertBox,
		setObject,
        update
    }
}

export const uistates_store = createUIStatesStore()


