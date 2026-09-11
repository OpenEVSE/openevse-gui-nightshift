import {_} 					from 'svelte-i18n'
import {DateTime} 			from "luxon";
import {EvseClients}		from "./vars.js"
import {get} 				from 'svelte/store'


export const removeDuplicateObjects = (array, key) => {
    const set = new Set()

    return array.filter(item => {
        const alreadyHas = set.has(item[key])
        set.add(item[key])

        return !alreadyHas
    })
}

export function sec2time(sec) {
	if (!sec)
		sec = 0
	const hours = Math.floor(sec / 3600)
	sec %= 3600
	const minutes = Math.floor(sec / 60);
	const seconds = sec % 60;
	return hours.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false }) + ':' + minutes.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false }) + ':' + seconds.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false })
}

export function formatDate(t,z,format=null) {
	let d
	if (z) {
		let tz = z.split("|")[0]
		d = DateTime.fromISO(t, {zone: tz})
	}
	else d = DateTime.fromISO(t)
	const arr = d.toLocaleString(DateTime.DATETIME_SHORT).split(" ")
	let datearr = arr[0].split("/")
	if (format=="short") {
		//remove year
		datearr.pop()
	}
	// fixing missing trailing 0 luxxon bug on US locale
	datearr[0] = datearr[0]?.length == 1?"0"+datearr[0]:datearr[0]
	datearr[1] = datearr[1]?.length == 1?"0"+datearr[1]:datearr[1]
	const date = datearr.join("/")
	let time = arr[1]
	if (arr[2]) 
		time += " " + arr[2]

	return date + " " + time
}

export function displayTime(t) {
	const d = DateTime.fromISO(t).toLocaleString(DateTime.TIME_SIMPLE) 
	return d
}

export function getTZ(s) {
	if(s) 
		return s.split('|')[0]
	else
		return "UTC"
}

export function createTzObj(tz) {
	var tzobj = []
	// @ts-ignore
	let idx = 0
	Object.entries(tz).forEach((element) => {
		if (!element[0].startsWith("Etc")) {
			tzobj[idx] = { name: element[0], value: element[0] + "|" + element[1] }
			idx++
		}
		else {
		}
	})
	return tzobj
}

// Human-readable byte size. ESP flash/partition sizes are powers of two, so a
// 16 MB chip (16777216 bytes) renders as "16 MB" without rounding artefacts.
export function formatBytes(bytes, decimals = 1) {
	if (bytes === undefined || bytes === null || isNaN(bytes)) return '—'
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
	const value = bytes / Math.pow(k, i)
	// Whole bytes have no fraction; larger units trim trailing zeros.
	return (i === 0 ? value : parseFloat(value.toFixed(decimals))) + ' ' + sizes[i]
}

export function round(value, precision = null) {
	var multiplier = Math.pow(10, precision || 0);
	return Math.round(value * multiplier) / multiplier;
}

export function temp_round(value) {
	if (isNaN(value)) {
		return ""
	}
	return round(value/10,1)
}

export let getBreakpoint = function () {
	const mobilemini = 410 
    const mobile = 640
    const tablet = 1280
    //const desktop = 1440
    var bp
    if (window.innerWidth <= mobilemini) bp = "mobilemini"
	else if (window.innerWidth > mobilemini && window.innerWidth <= mobile) bp = "mobile"
    else if (window.innerWidth > mobile && window.innerWidth <= tablet) bp = "tablet"
    else if (window.innerWidth > tablet) bp="desktop"
    else bp="unknown"
   
    return bp;
};

export function clientid2name(id) {
	let output = "null"
	Object.keys(EvseClients).forEach(key => {
		if (id == EvseClients[key].id) {
			output = key
		}
	})
	return output
}

export function getStateDesc(state) {
	switch (state) {
		case 0: return get(_)("logs-states.loading")
		case 1: return get(_)("logs-states.active-nocar")
		case 2: return get(_)("logs-states.active-car")
		case 3: return get(_)("logs-states.active-charge")
		// Errors
		case 4: return get(_)("logs-states.error-vent")
		case 5: return get(_)("logs-states.error-diode")
		case 6: return get(_)("logs-states.error-gfi")
		case 7: return get(_)("logs-states.error-ground")
		case 8: return get(_)("logs-states.error-relay")
		case 9: return get(_)("logs-states.error-gfitest")
		case 10: return get(_)("logs-states.error-temp")
		case 11: return get(_)("logs-states.error-current")
		// Disabled
		case 254: return get(_)("logs-states.sleeping")
		case 255: return get(_)("logs-states.disabled")
	}
}

export function dedup(arr) {
	var hashTable = {};

	return arr.filter(function (el) {
		var key = JSON.stringify(el);
		var match = Boolean(hashTable[key]);

		return (match ? false : hashTable[key] = true);
	});
}

// export function s2mns(s){return(s-(s%=60))/60+(9<s?'mn ':'mn 0')+s+'s'}

export function s2mns(s) {
	return new Date(s * 1000).toISOString().slice(11, 19);
}


export function miles2km(d) {
	return d * 1.60934
}

export function isFloat(n) {
	return n === +n && n !== (n|0);
}

export function isInteger(n) {
    return n === +n && n === (n|0);
}

export function JSONTryParse(input) {
	try {
		//check if the string exists
		if (input) {
			var o = JSON.parse(input);

			//validate the result too
			if (o && o.constructor === Object) {
				return o;
			}
		}
	}
	catch (e) {
	}
	return false;
};

export function compareVersion(last, old) {
	if (typeof last !== 'string') return 0
	if (typeof old !== 'string') return 0
	if (last[0] == "v") {
		last = last.substring(1)
	}
	if (old[0] == "v") {
		old = old.substring(1)
	}
	else return 0
	last = last.split('.')
	old = old.split('.')
	const k = Math.min(last.length, old.length)
	for (let i = 0; i < k; ++i) {
		last[i] = parseInt(last[i], 10)
		old[i] = parseInt(old[i], 10)
		if (last [i] > old[i]) return 1
		if (last [i] < old[i]) return -1
	}
	return last.length == old.length ? 0 : (last.length < old.length ? -1 : 1)
}
