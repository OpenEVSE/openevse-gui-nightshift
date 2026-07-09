<script>
  import { derived } from 'svelte/store'
  import { limit_store } from '../stores/limit.js'
  import { uisettings_store } from '../stores/uisettings.js'
  import { EvseClients } from '../vars.js'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { schedule_store } from '../stores/schedule.js'
  import { certificate_store } from '../stores/certificates.js'
  import { plan_store } from '../stores/plan.js'
  import { config_store } from '../stores/config.js'
  import { claims_target_store } from '../stores/claims_target.js'
  import { claims_store } from '../stores/claims.js'
  import { override_store } from '../stores/override.js'
  import { clientid2name, formatDate } from '../utils.js'
  import { serialQueue } from '../queue.js'
  import { onMount } from 'svelte'
  import { locale, locales } from 'svelte-i18n'
  import { _ } from 'svelte-i18n'

  // setTimeout instances
  let counter_divert_update
  let counter_vehicle_update
  let counter_rfid_scan
  let counter_elapsed

  // derived stores replacing keyed stores (keyed stores do not trigger an update if the same value is published)
  const time = derived(status_store, ($s) => $s?.time)
  const config_version = derived(status_store, ($s) => $s?.config_version)
  const schedule_version = derived(status_store, ($s) => $s?.schedule_version)
  const schedule_plan_version = derived(status_store, ($s) => $s?.schedule_plan_version)
  const claims_version = derived(status_store, ($s) => $s?.claims_version)
  const override_version = derived(status_store, ($s) => $s?.override_version)
  const limit_version = derived(status_store, ($s) => $s?.limit_version)
  const evse_state = derived(status_store, ($s) => $s?.state)
  const charging = derived(evse_state, ($s) => $s == 3 ? true : false)
  const rfid_waiting = derived(status_store, ($s) => $s?.rfid_waiting)
  const elapsed = derived(status_store, ($s) => $s?.session_elapsed)
  const ipaddress = derived(status_store, ($s) => $s?.ipaddress)

  let refresh_config = false
  let refresh_schedule = false
  let refresh_certificate = false
  let refresh_target = false
  let refresh_override = false
  let refresh_plan = false
  let refresh_limit = false
  let prev_ip
  let ip_changed = false

  onMount(() => {
    getMode($claims_target_store?.properties?.state, $claims_target_store?.claims?.state)
  })

  export function refreshDateTime(t, tz) { // params: time (isostring) , timezone
    $uistates_store.time_localestring = formatDate(t, tz)
  }

  export async function refreshConfigStore(ver) {
    if (refresh_config)
      return
    if (ver != $uistates_store.config_version) {
      refresh_config = true
      const res = await serialQueue.add(config_store.download)
      if (res)
        $uistates_store.config_version = ver
      refresh_config = false
      return res
    }
  }

  export async function refreshSchedulestore(ver) {
    if (refresh_schedule)
      return
    if (ver != $uistates_store.schedule_version) {
      refresh_schedule = true
      $uistates_store.schedule_version = ver
      const res = await serialQueue.add(schedule_store.download)
      refresh_schedule = false
      return res
    }
  }

  export async function refreshCertificateStore(ver) {
    if (refresh_certificate)
      return
    if (ver != $uistates_store.certificate_version) {
      refresh_certificate = true
      $uistates_store.certificate_version = ver
      const res = await serialQueue.add(certificate_store.download)
      refresh_certificate = false
      return res
    }
  }

  export async function refreshPlanStore(ver) {
    if (refresh_plan)
      return
    if (ver != $uistates_store.schedule_plan_version) {
      refresh_plan = true
      $uistates_store.schedule_plan_version = ver
      const res = await serialQueue.add(plan_store.download)
      refresh_plan = false
      return res
    }
  }

  export async function refreshClaimsTargetStore(ver) {
    if (refresh_target)
      return
    if (ver != $uistates_store.claims_version) {
      refresh_target = true
      $uistates_store.claims_version = ver
      const res = await serialQueue.add(claims_target_store.download)
      // The claims list (with real per-claim priorities) changes in lockstep
      // with the target, so refresh it on the same version bump.
      await serialQueue.add(claims_store.download)
      if (res) {
        getMode($claims_target_store?.properties?.state, $claims_target_store?.claims?.state)
      }
      refresh_target = false
      return res
    }
    return false
  }

  export async function refreshOverrideStore(version) {
    if (refresh_override)
      return
    if ($uistates_store.override_version != version) {
      refresh_override = true
      $uistates_store.override_version = version
      const res = await serialQueue.add(override_store.download)
      refresh_override = false
      if (res)
        return res
      else return false
    }
    else return true
  }

  export async function refreshStatusStore() {
    const res = await serialQueue.add(status_store.download)
    return res
  }

  export async function refreshLimitStore(version) {
    if (refresh_limit)
      return
    if ($uistates_store.limit_version != version) {
      if ($status_store?.limit) {
        refresh_limit = true
        const res = await serialQueue.add(limit_store.download)
        refresh_limit = false
        if (res) {
          $uistates_store.limit_version = version
          return res
        }
        else {
          return false
        }
      }
      else {
        limit_store.reset()
        $uistates_store.limit_version = version
      }
    }
    else return true
  }

  export function refreshChargingState(val) {
    $uistates_store.charging = val
  }

  function getMode(evseState, clientid) {
    $uistates_store.stateclaimfrom = clientid2name(clientid)
    if (clientid == EvseClients["manual"].id) {
      // Mode Manual
      switch (evseState) {
        case "active":
          $uistates_store.mode = 1 // On
          break
        case "disabled":
          $uistates_store.mode = 2 // Off
          break;
        default:
          break
      }
    }
    else {
      // mode Auto
      $uistates_store.mode = 0
    }
  }

  function countDivertUpdate(val) {
    $uistates_store.divert_update = val
    clearInterval(counter_divert_update)
    counter_divert_update = setInterval(() => {
      $uistates_store.divert_update++
    }, 1000);
  }

  function countVehicleUpdate(val) {
    $uistates_store.vehicle_state_update = val
    clearInterval(counter_vehicle_update)
    counter_vehicle_update = setInterval(() => {
      $uistates_store.vehicle_state_update++
    }, 1000);
  }

  function countRFIDScan(val) {
    $uistates_store.rfid_waiting = val
    clearInterval(counter_rfid_scan)
    counter_rfid_scan = setInterval(() => {
      $uistates_store.rfid_waiting--
      if ($uistates_store.rfid_waiting == 0) {
        clearInterval(counter_rfid_scan)
      }
    }, 1000);
  }

  function countElapsed(val, charging) {
    $uistates_store.elapsed = val
    clearInterval(counter_elapsed)
    if (charging) {
      counter_elapsed = setInterval(() => {
        $uistates_store.elapsed++
      }, 1000);
    }
  }

  function refreshLocale(lang) {
    // The device reports its configured language; an empty string means
    // "no preference". Only adopt a language this build actually ships —
    // setting an empty/unbundled locale breaks message formatting.
    if (!lang || !$locales.includes(lang)) return
    if ($locale !== lang) {
      $locale = lang
      uisettings_store.set({ ...$uisettings_store, lang: $locale })
    }
  }

  async function redirect2ip(ip) {
    if (ip != prev_ip) {
      if (ip && ip != "192.168.4.1" && prev_ip) {
        uistates_store.resetAlertBox()
        $uistates_store.alertbox.visible = true
        $uistates_store.alertbox.title = $_("notification")
        $uistates_store.alertbox.body = $_("config.network.con-ok") + ip
        $uistates_store.alertbox.button = true
        $uistates_store.alertbox.closable = false
        $uistates_store.alertbox.action = () => { window.location.href = "http://" + ip + "/" + (window.location.hash || "#/") }
      }
      prev_ip = ip
      ip_changed = true
    }
  }

  function setErrorState(evseState) {
    if (evseState >= 4 && evseState <= 11) {
      // error state
      $uistates_store.error = true
    }
    else $uistates_store.error = false
  }

  // Refresh stores when new version is published over websocket
  $effect(() => { refreshConfigStore($config_version) })
  $effect(() => { refreshSchedulestore($schedule_version) })
  $effect(() => { refreshPlanStore($schedule_plan_version) })
  $effect(() => { refreshClaimsTargetStore($claims_version) })
  $effect(() => { refreshOverrideStore($override_version) })
  $effect(() => { refreshLimitStore($limit_version) })
  $effect(() => { refreshDateTime($time, $config_store?.time_zone) })
  $effect(() => { refreshChargingState($charging) })
  $effect(() => { refreshLocale($config_store?.lang) })
  $effect(() => { countDivertUpdate($status_store?.divert_update) })
  $effect(() => { countVehicleUpdate($status_store?.vehicle_state_update) })
  $effect(() => { countRFIDScan($rfid_waiting) })
  $effect(() => { countElapsed($elapsed, $charging) })
  $effect(() => { redirect2ip($ipaddress) })
  $effect(() => { setErrorState($evse_state) })
</script>
