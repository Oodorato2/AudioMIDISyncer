import { miz, music_reader } from './lib/miz_music.min.js'

export class AMC
{
    SMFArrayBuffer = null
    parsedSMF = null

    resolution = 0
    tempos = []
    events = []
    notes = []
    pitchs = []
    finishNoteOffTime = 0
    endTime = 0

    /**
     * @type {EventObj}
     */
    eventDfo = {
        evt: 0,// MIDIイベント値
        msg: 0,// MIDIイベントメッセージ
        step: 0,// 前のMIDIイベントからの空白値
        value: 0,// MIDIイベントのデータ
        aryValue: [0, 0, 0],// MIDIイベントの生データ
        track: 0,// トラック
        trackDataIndex: 0,// トラック内のMIDIイベントのインデックス
        channel: 0,// チャンネル
        eventId: 0,// MIDIイベントの独自ユニークID(連番)
        trackCurrentTick: 0,// トラック内のMIDIイベント絶対値tick
        msTime: 0,
        act: -1,
    }

    async setup (arrayBuffer)
    {
        await this.setSMFArrayBuffer(arrayBuffer)
        await this.setParsedSMF(this.SMFArrayBuffer)
        await this.setResolution(this.parsedSMF.m_nTimeDiv)

        await this.setTempos()
        await this.setEvents()
        await this.setNotes()
        await this.setPitchs()
        await this.setEndTime()
    }

    async setSMFArrayBuffer (arrayBuffer)
    {
        this.SMFArrayBuffer = arrayBuffer
    }

    async setParsedSMF (arrayBuffer)
    {
        this.parsedSMF = music_reader(arrayBuffer)
    }

    async setResolution (resolution)
    {
        this.resolution = resolution
    }

    /**
     * MIDIイベントをすべて参照していき、callbackの引数に渡します。
     * 
     * @param {Function} callback 条件を指定した関数 return は boolean型 にします。trueを返すと、MIDIイベントオブジェクトを返します。
     * @param {EventObj} dataObj MIDIイベントオブジェクトの初期値を指定します。
     * @param {Boolean} currentTrackOnly そのトラックのみの参照とするか。 true とすると次のtrackへは進みません。
     * 
     * @return {*} false または EventObj
     */
    eventsForEach (callback, dataObj = {}, currentTrackOnly = false)
    {
        dataObj = {...this.eventDfo, ...dataObj}
        for (let track = Math.max((dataObj.track - 1), 0), eventId = (dataObj.eventId + 1); track < this.parsedSMF.m_listTrack.length; track++) {
            for (let trackDataIndex = dataObj.trackDataIndex, trackCurrentTick = dataObj.trackCurrentTick; trackDataIndex < this.parsedSMF.m_listTrack[track].m_listData.length; trackDataIndex++) {
                let
                    evt = this.parsedSMF.m_listTrack[track].m_listData[trackDataIndex].m_eMEvt,
                    msg = this.parsedSMF.m_listTrack[track].m_listData[trackDataIndex].m_eMMsg,
                    step = this.parsedSMF.m_listTrack[track].m_listData[trackDataIndex].m_nStep,
                    value = this.parsedSMF.m_listTrack[track].m_listData[trackDataIndex].m_numValue,
                    aryValue = this.parsedSMF.m_listTrack[track].m_listData[trackDataIndex].m_aryValue,
                    channel = (aryValue[0] & 0x0F) + 1,
                    resultObj = {...this.eventDfo},
                    msTime = 0

                trackCurrentTick += step

                if (this.tempos.length) {
                    msTime = this.toTickMs(trackCurrentTick)
                }

                resultObj = {
                    ...resultObj,
                    evt,
                    msg,
                    step,
                    value,
                    aryValue,
                    track: (track + 1),
                    trackDataIndex,
                    channel,
                    eventId,
                    trackCurrentTick,
                    msTime,
                }

                if (callback(resultObj)) {
                    return resultObj
                }

                eventId++
            }
            if (currentTrackOnly) {
                return false
            }
        }
    }

    /**
     * 指定の位置から後のMIDIイベントを参照していき、指定の条件に一致したMIDIイベントを返します。
     * 次のtrackへは進みません。
     * 
     * @param {EventObj} dataObj MIDIイベントオブジェクト
     * @param {Function} callback 条件を指定した関数 return は boolean型 にします。
     * 
     * @return {*} false または EventObj
     */
    trackNextMatchEvent (dataObj = {}, callback)
    {
        dataObj = {...this.eventDfo, ...dataObj}
        dataObj.trackDataIndex++
        return this.eventsForEach(callback, dataObj, true)
    }

    async setTempos ()
    {
        this.eventsForEach(event => {
            if (event.msg === 255 && event.evt === 81) {
                let step = 0
                if (this.tempos.length) {
                    step = event.trackCurrentTick - this.tempos[this.tempos.length - 1].trackCurrentTick
                }
                this.tempos.push({
                    tempo: this.toTempo(event.value),
                    ...event,
                    step,
                })
            }
        })
        this.tempos.sort((a, b) => {
            if (a.trackCurrentTick < b.trackCurrentTick) {
                return -1
            }
            if (a.trackCurrentTick > b.trackCurrentTick) {
                return 1
            }
            return 0
        })
        for (let i = 0; i < this.tempos.length; i++) {
            if (i === 0) {
                this.tempos[i].msTime = 0
            }
            if (i+1 < this.tempos.length) {
                this.tempos[i+1].msTime = (((this.tempos[i+1].step) * (this.tempos[i].value / this.resolution))/1000) + this.tempos[i].msTime
            }
        }
    }

    async setEvents ()
    {
        this.eventsForEach(event => {
            this.events.push(event)
        })
    }

    async setNotes ()
    {
        let isGetEventIds = []
        this.events.forEach(event => {
            if (event.msg === miz.music.E_MIDI_MSG.NOTE_ON && event.aryValue[2] > 0)
            {
                let
                    onTime = event.msTime,
                    offTime = undefined,
                    offNoteEvent = this.trackNextMatchEvent(event, nextEvent => {
                        if (!isGetEventIds.includes(nextEvent.eventId) && (nextEvent.msg === miz.music.E_MIDI_MSG.NOTE_ON || nextEvent.msg === miz.music.E_MIDI_MSG.NOTE_OF))
                        {
                            if ((nextEvent.aryValue[2] === 0 || nextEvent.msg === miz.music.E_MIDI_MSG.NOTE_OF) && nextEvent.aryValue[1] === event.aryValue[1])
                            {
                                return true
                            }
                        }
                    }),
                    gate = undefined,
                    beat = undefined

                if (offNoteEvent) {
                    isGetEventIds.push(offNoteEvent.eventId)
                    offTime = offNoteEvent.msTime
                    gate = offNoteEvent.trackCurrentTick - event.trackCurrentTick
                    beat = gate / this.resolution
                } else {
                    console.log({
                        message: 'not find note off',
                        error:{
                            ...event,
                            onTime,
                        }
                    })
                    return false
                }

                this.notes.push({
                    type: 'note',
                    eventId: event.eventId,
                    scale: event.aryValue[1],
                    velocity: event.aryValue[2],
                    beat: beat,// 四分音符を1とした値
                    onTime: onTime,
                    offTime: offTime,
                    track: event.track,
                    channel: event.channel,
                    act: -1,// 音符の状態(0 = 鳴る前, 1 = 鳴っている最中, 2 = 鳴り終わった)
                    trackCurrentTick: event.trackCurrentTick,
                    gate: gate,
                })

                // 最終ノートの終了時間を取得
                if (this.finishNoteOffTime < offTime) {
                    this.finishNoteOffTime = offTime
                }
                
            }
        })
    }

    async setPitchs ()
    {
        this.events.forEach(event => {
            if (event.msg === miz.music.E_MIDI_MSG.PITCH) {
                this.pitchs.push({
                    pitch: (event.aryValue[1] + (event.aryValue[2] * 128)) - 8192,// 最小 -8192, 最大 8191
                    ...event
                })
            }
        })
    }

    async setEndTime ()
    {
        let trackCurrentTick = 0
        this.events.forEach(event => {
            // 最終ノートの終了時間を取得
            if (trackCurrentTick < event.trackCurrentTick) {
                trackCurrentTick = event.trackCurrentTick
            }
        })
        this.endTime = this.toTickMs(trackCurrentTick)
    }

    getToMsPitch (Ms, track = null, channel = null)
    {
        let
            currentPitchMs = 0,
            currentPitchIndex = null

        for (let i = 0; i < this.pitchs.length; i++) {
            if (track !== null && this.pitchs[i].track !== track) {
                break
            }
            if (channel !== null && this.pitchs[i].channel !== channel) {
                break
            }
            if (this.pitchs[i].msTime <= Ms && currentPitchMs <= this.pitchs[i].msTime) {
                currentPitchMs = this.pitchs[i].msTime
                currentPitchIndex = i
            }
        }

        if (currentPitchIndex === null) {
            return {
                pitch: 0,
                ...this.eventDfo,
            }
        }

        return this.pitchs[currentPitchIndex]
    }

    getStartStepTempo ()
    {
        let result = 0
        if (this.tempos) {
            for (let i = 0; i < this.tempos.length; i++) {
                if (this.tempos[i].trackCurrentTick === this.tempos[0].trackCurrentTick) {
                    result = this.tempos[i].value
                }
            }
        }
        return result
    }

    getStartTempo ()
    {
        return this.toTempo(this.getStartStepTempo())
    }

    isNextTempo (i, tick)
    {
        if (i+1 >= this.tempos.length) {
            return 1
        } else if (this.tempos[i+1].trackCurrentTick > tick) {
            return 1
        } else {
            return 0
        }
    }

    isNextTempoMs (i, Ms)
    {
        if (i+1 >= this.tempos.length) {
            return 1
        } else if (this.tempos[i+1].msTime > Ms) {
            return 1
        } else {
            return 0
        }
    }

    toTempo (stepTemop)
    {
        let _pow = Math.pow( 10 , 3 )
        return Math.round(((60 * 1000 * 1000) / stepTemop) * _pow) / _pow
    }

    // tickからその時のステップテンポを取得
    toTickStepTemop (tick)
    {
        return this.toTickTemopData(tick).value
    }

    toTickTemop (tick)
    {
        return this.toTempo(this.toTickStepTemop(tick))
    }

    toTickTemopData (tick)
    {
        let result = false
        for (let i = 0; i < this.tempos.length; i++) {
            if (this.tempos[i].trackCurrentTick <= tick && this.isNextTempo(i, tick)) {
                for (let p = 0; p < this.tempos.length; p++) {
                    if (this.tempos[p].trackCurrentTick === this.tempos[i].trackCurrentTick) {
                        result = this.tempos[p]
                    }
                }
                return result
            }
        }
    }

    toMsStepTemop (Ms)
    {
        let result = false
        for (let i = 0; i < this.tempos.length; i++) {
            if (this.tempos[i].msTime <= Ms && this.isNextTempoMs(i, Ms)) {
                for (let p = 0; p < this.tempos.length; p++) {
                    if (this.tempos[p].msTime === this.tempos[i].msTime) {
                        result = this.tempos[p]
                    }
                }
                return result
            }
        }
    }

    toTickMs (tick)
    {
        return (((tick - this.toTickTemopData(tick).trackCurrentTick) * (this.toTickStepTemop(tick) / this.resolution))/1000) + this.toTickTemopData(tick).msTime
    }

    toMsTick (Ms)
    {
        if (Ms < 0) {
            Ms = 0
        }
        return ((Ms - this.toMsStepTemop(Ms).msTime) / ((this.toMsStepTemop(Ms).value / this.resolution)/1000)) + this.toMsStepTemop(Ms).trackCurrentTick
    }
}