import { miz, music_reader } from './lib/miz_music.min.js'

export class Listener
{
    constructor (SMF, Audio, options)
    {
        this.sets(SMF, Audio, options)
        this.loadfiles()
    }

    sets (SMF, Audio, options)
    {
        this.inOptions = options
        this.setOptions(this.inOptions)
        this.setFiles(SMF, Audio)
        this.fileLoadingState = {
            preparing: 0,
            ready: 0,
        }
        this.setupEventListener()
        this.player = {
            currentTime: -1,
            timeStamp: 0,
            startTimeStamp: 0,
            pauseTime: 0,
            status: 'stop',
        }
    }

    setOptions (options)
    {
        this.options = {
            audioSync: true,
            renderTimeShift: 0,
        }
        if (options !== undefined) {
            if (typeof(options) === 'object' && options !== null) {
                for (let option in options) {
                    if (this.options[option] !== undefined) {
                        this.options[option] = options[option]
                    }
                }
            }
        }
    }

    setFiles (SMF, Audio)
    {
        this.setSMF(SMF)
        this.setAudio(Audio)
    }

    setSMF (SMF)
    {
        this.SMF = SMF
    }

    setAudio (Audio)
    {
        this.Audio = Audio
    }
 
    async loadfiles (SMF, Audio)
    {
        this.filePreparing()
        await this.loadSMF(SMF)
        await this.loadAudio(Audio)
        this.fileReady()
    }

    async loadSMF (SMF)
    {
        if (this.player.status === 'play' || this.player.status === 'pause') {
            this.stop()
        }
        if (SMF === undefined) {
            SMF = this.SMF
        }
        try {

            let
                MIDIOriSource = null

            if (typeof(SMF) === 'string' && SMF !== '') {
                MIDIOriSource = SMF
            } else if (SMF instanceof HTMLElement && SMF.type === 'file' && SMF.files.length) {
                MIDIOriSource = URL.createObjectURL(SMF.files[0])
            } else if (SMF instanceof File && SMF) {
                MIDIOriSource = URL.createObjectURL(SMF)
            } else {
                throw new Error(`error: MIDIOriSource`)
            }

            if (MIDIOriSource) {
                this.filePreparing()
                let response = await fetch(MIDIOriSource)
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                this.SMFSource =  music_reader(await response.arrayBuffer())
                this.setMidi()
                this.fileReady()
            }
        } catch (error) {
            this.options.audioSync = false
        }
    }

    async loadAudio (Audio)
    {
        this.setOptions(this.inOptions)
        if (this.player.status === 'play' || this.player.status === 'pause') {
            this.stop()
        }
        this.AudioContext = new (window.AudioContext || window.webkitAudioContext || window.Audio)()
        this.AudioBuffer = undefined
        if (!this.AudioContext.state) {
            this.AudioContext.preload = 'none'
        }
        if (Audio === undefined) {
            Audio = this.Audio
        }
        try {

            let
                AudioOriSource = null

            if (typeof(Audio) === 'string' && Audio !== '') {
                AudioOriSource = Audio
            } else if (Audio instanceof HTMLElement && Audio.type === 'file' && Audio.files.length) {
                AudioOriSource = URL.createObjectURL(Audio.files[0])
            } else if (Audio instanceof File && Audio) {
                AudioOriSource = URL.createObjectURL(Audio)
            } else {
                throw new Error(`error: AudioOriSource`)
            }

            if (AudioOriSource) {
                this.filePreparing()
                let response = await fetch(AudioOriSource)
                if (this.AudioContext.state) {
                    const arrayBuffer = await response.arrayBuffer()
                    this.AudioContext.decodeAudioData(arrayBuffer, buffer => {
                        this.AudioBuffer = buffer
                        this.fileReady()
                    })
                } else {
                    const blob = await response.blob()
                    this.AudioContext.src = URL.createObjectURL(blob)
                    this.AudioContext.addEventListener('loadeddata', event => {
                        if (this.AudioContext.readyState < 2) {
                            this.options.audioSync = false
                        }
                        this.fileReady()
                    })
                    this.AudioContext.load()
                }
            }

        } catch (error) {
            this.options.audioSync = false
        }
    }

    createAudioSource ()
    {
        if (this.AudioContext.state) {
            this.AudioSource = this.AudioContext.createBufferSource()
            this.AudioSource.buffer = this.AudioBuffer
            this.AudioSource.connect(this.AudioContext.destination)
        }
    }

    filePreparing ()
    {
        this.removeEventListener('render', '_this_NotesListener')
        this.fileLoadingState.preparing += 1
    }

    fileReady ()
    {
        this.fileLoadingState.ready += 1
        if (this.fileLoadingState.ready === this.fileLoadingState.preparing) {
            this.actionEventListener('ready')
            if(this.anime !== undefined) {
                cancelAnimationFrame(this.anime)
            }
            if(this.MIDI !== undefined) {
                this.addEventListener('render', () => this.NotesListener(), '_this_NotesListener')
            }
            this.anime = requestAnimationFrame((timeStamp) => this.render(timeStamp))
        }
    }

    setupEventListener ()
    {
        this.EventListeners = {}
    }

    setMidi ()
    {
        this.MIDI = {
            resolution: this.SMFSource.m_nTimeDiv,
            endTime: 0,
            tempos: [],
            track: []
        }
        this.setMidiTempos()
        this.setMidiNots()
    }

    setMidiTempos ()
    {
        for (let p = 0; p < this.SMFSource.m_listTrack.length; p++) {
            for (let i = 0, tick = 0, step = 0; i < this.SMFSource.m_listTrack[p].m_listData.length; i++) {
                tick += this.SMFSource.m_listTrack[p].m_listData[i].m_nStep
                step += this.SMFSource.m_listTrack[p].m_listData[i].m_nStep
                if (this.SMFSource.m_listTrack[p].m_listData[i].m_eMMsg === 255 && this.SMFSource.m_listTrack[p].m_listData[i].m_eMEvt === 81) {
                    this.MIDI.tempos.push({
                        tempo: this.toTempo(this.SMFSource.m_listTrack[p].m_listData[i].m_numValue),
                        data: this.SMFSource.m_listTrack[p].m_listData[i].m_numValue,
                        tick: tick,
                        step: step,
                    })
                    step = 0
                }
            }
        }
        this.MIDI.tempos.sort((a, b) => {
            if (a.tick < b.tick) {
                return -1
            }
            if (a.tick > b.tick) {
                return 1
            }
            return 0
        })
        for (let i = 0; i < this.MIDI.tempos.length; i++) {
            if (i === 0) {
                this.MIDI.tempos[i].ms = 0
            }
            if (i+1 < this.MIDI.tempos.length) {
                this.MIDI.tempos[i+1].ms = (((this.MIDI.tempos[i+1].step) * (this.MIDI.tempos[i].data / this.MIDI.resolution))/1000) + this.MIDI.tempos[i].ms
            }
        }
    }

    setMidiNots ()
    {
        for (let t = 0, noteNum = 0; t < this.SMFSource.m_listTrack.length; t++) {
            this.MIDI.track.push([])
            for (let i = 0, tick = 0; i < this.SMFSource.m_listTrack[t].m_listData.length; i++) {
                tick += this.SMFSource.m_listTrack[t].m_listData[i].m_nStep
                if (
                    this.SMFSource.m_listTrack[t].m_listData[i].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_ON
                    && this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[2] > 0
                ) {

                    let
                        onTime = this.toTickMs(tick),
                        offTime = undefined,
                        step = 0
                    
                    for (let ii = i+1, tickI = tick; ii < this.SMFSource.m_listTrack[t].m_listData.length; ii++) {
                        step += this.SMFSource.m_listTrack[t].m_listData[ii].m_nStep
                        tickI += this.SMFSource.m_listTrack[t].m_listData[ii].m_nStep
                        if (
                            this.SMFSource.m_listTrack[t].m_listData[ii].get === undefined
                            && (
                                this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_ON
                                || this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_OF
                            )
                        ) {
                            if (
                                (
                                    this.SMFSource.m_listTrack[t].m_listData[ii].m_aryValue[2] === 0
                                    || this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_OF
                                )
                                && this.SMFSource.m_listTrack[t].m_listData[ii].m_aryValue[1] === this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[1]
                            ) {
                                this.SMFSource.m_listTrack[t].m_listData[ii].get = true
                                offTime = this.toTickMs(tickI)
                                break
                            }
                        }

                    }

                    if (offTime === undefined) {
                        console.log({
                            message: 'not find note off',
                            error:{
                                track: t,
                                channel: (this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[0] & 0x0F),
                                velocity: this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[2],
                                key: i,
                                onTime: onTime,
                            }
                        })
                        break
                    }

                    this.MIDI.track[t].push({
                        tick: tick,
                        onTime: onTime,
                        offTime: offTime,
                        track: t,
                        channel: (this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[0] & 0x0F),
                        type: 'note',
                        scale: this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[1],
                        velocity: this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[2],
                        step: step,
                        id: noteNum,
                        act: -1,// 音符の状態(0 = 鳴る前, 1 = 鳴っている最中, 2 = 鳴り終わった)
                    })

                    // 最終ノートの終了時間を取得
                    if (this.MIDI.endTime < offTime) {
                        this.MIDI.endTime = offTime
                    }

                    noteNum++
                }
            }
        }
    }

    getStartStepTempo ()
    {
        let result = 0
        if (this.MIDI.tempos) {
            for (let i = 0; i < this.MIDI.tempos.length; i++) {
                if (this.MIDI.tempos[i].tick === this.MIDI.tempos[0].tick) {
                    result = this.MIDI.tempos[i].data
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
        if (i+1 >= this.MIDI.tempos.length) {
            return 1
        } else if (this.MIDI.tempos[i+1].tick > tick) {
            return 1
        } else {
            return 0
        }
    }

    isNextTempoMs (i, Ms)
    {
        if (i+1 >= this.MIDI.tempos.length) {
            return 1
        } else if (this.MIDI.tempos[i+1].ms > Ms) {
            return 1
        } else {
            return 0
        }
    }

    toTempo (StepTemop)
    {
        let _pow = Math.pow( 10 , 3 )
        return Math.round(((60 * 1000 * 1000) / StepTemop) * _pow) / _pow
    }

    // tickからその時のステップテンポを取得
    toTickStepTemop (tick)
    {
        return this.toTickTemopData(tick).data
    }

    toTickTemop (tick)
    {
        return this.toTempo(this.toTickStepTemop(tick))
    }

    toTickTemopData (tick)
    {
        let result = false
        for (let i = 0, ftstep = 0; i < this.MIDI.tempos.length; i++) {
            if (this.MIDI.tempos[i].tick <= tick && this.isNextTempo(i, tick)) {
                for (let p = 0; p < this.MIDI.tempos.length; p++) {
                    if (this.MIDI.tempos[p].tick === this.MIDI.tempos[i].tick) {
                        result = this.MIDI.tempos[p]
                    }
                }
                return result
            }
        }
    }

    toMsStepTemop (Ms)
    {
        let result = false
        for (let i = 0, ftstep = 0; i < this.MIDI.tempos.length; i++) {
            if (this.MIDI.tempos[i].ms <= Ms && this.isNextTempoMs(i, Ms)) {
                for (let p = 0; p < this.MIDI.tempos.length; p++) {
                    if (this.MIDI.tempos[p].ms === this.MIDI.tempos[i].ms) {
                        result = this.MIDI.tempos[p]
                    }
                }
                return result
            }
        }
    }

    toTickMs (tick)
    {
        return (((tick - this.toTickTemopData(tick).tick) * (this.toTickStepTemop(tick) / this.MIDI.resolution))/1000) + this.toTickTemopData(tick).ms
    }

    toMsTick (Ms)
    {
        if (Ms < 0) {
            Ms = 0
        }
        return ((Ms - this.toMsStepTemop(Ms).ms) / ((this.toMsStepTemop(Ms).data / this.MIDI.resolution)/1000)) + this.toMsStepTemop(Ms).tick
    }

    actionEventListener (eventname, _arguments)
    {
        if (this.EventListeners[eventname] !== undefined) {
            if (0 < this.EventListeners[eventname].length) {
                if (_arguments === undefined) {
                    _arguments = []
                }
                for (let i = 0; i < this.EventListeners[eventname].length; i++) {
                    if (this.EventListeners[eventname][i] !== undefined) {
                        this.EventListeners[eventname][i].func.apply(this, _arguments)
                    }
                }
            }
        }
    }

    loopNotes (callback)
    {
        for (let t = 0; t < this.MIDI.track.length; t++) {
            for (let n = 0; n < this.MIDI.track[t].length; n++) {
                callback(this.MIDI.track[t][n])
            }
        }
    }

    NotesListener ()
    {
        let
            time = this.player.currentTime

        this.loopNotes(event => {

            if (event.type === 'note') {

                // 音符イベント
                if (event.onTime > time) {

                    // Before sounding a note.

                    if (event.act !== 0) {
                        this.actionEventListener('onlyOnceNoteBeforeSounding', [event, time])// 1度のみ検知
                        event.act = 0
                    }

                    this.actionEventListener('noteBeforeSounding', [event, time])// 常時検知

                } else if (event.onTime <= time && event.offTime > time) {

                    // Sounding the note.

                    if (event.act !== 1) {
                        this.actionEventListener('onlyOnceNoteSounding', [event, time])// 1度のみ検知
                        event.act = 1
                    }

                    this.actionEventListener('noteSounding', [event, time])// 常時検知

                } else if (event.offTime <= time) {

                    // After sounding a note.

                    if (event.act !== 2) {
                        this.actionEventListener('onlyOnceNoteAfterSounding', [event, time])// 1度のみ検知
                        event.act = 2
                    }

                    this.actionEventListener('noteAfterSounding', [event, time])// 常時検知

                }

            }

        })
    }

    render (timeStamp)
    {
        if (this.options.audioSync) {
            this.player.timeStamp = this.AudioContext.currentTime * 1000
        } else {
            this.player.timeStamp = timeStamp
        }
        if (this.player.status === 'play') {
            this.player.currentTime = this.player.timeStamp - this.player.startTimeStamp + this.options.renderTimeShift
        }
        this.actionEventListener('render', [timeStamp])
        this.anime = requestAnimationFrame((timeStamp) => this.render(timeStamp))
    }

    // 以下外部からのアクセス許可

    play ()
    {
        let starttime = 0
        if (this.player.status === 'pause') {
            starttime = this.player.currentTime
        }
        if (this.AudioContext.state && this.AudioBuffer) {
            this.createAudioSource()
            this.AudioSource.start(this.AudioContext.currentTime, starttime/1000)
        } else if (this.AudioContext.readyState >= 2) {
            this.AudioContext.play()
        }
        this.player.status = 'play'
        this.player.startTimeStamp = this.player.timeStamp - starttime
        this.actionEventListener('playerPlay')
    }

    pause ()
    {
        if (this.player.status === 'play') {
            if (this.AudioContext.state && this.AudioBuffer) {
                this.AudioSource.stop()
            } else if (this.AudioContext.readyState >= 2) {
                this.AudioContext.pause()
                this.AudioContext.currentTime = this.player.currentTime / 1000
            }
            this.player.status = 'pause'
            this.actionEventListener('playerPause')
        }
    }

    stop ()
    {
        if (this.AudioContext.state && this.AudioBuffer) {
            this.AudioSource.stop()
        } else if (this.AudioContext.readyState >= 2){
            this.AudioContext.pause()
            this.AudioContext.currentTime = 0
        }
        this.player.status = 'stop'
        this.player.startTimeStamp = 0
        this.player.currentTime = -1
        this.actionEventListener('playerStop')
    }

    addEventListener (eventname, _function, funcName)
    {
        if (this.EventListeners[eventname] === undefined) {
            this.EventListeners[eventname] = []
        }
        if (!funcName) {
            funcName = crypto.randomUUID()
        }
        this.EventListeners[eventname].push({
            name: funcName,
            func: _function,
        })

        return funcName
    }

    removeEventListener (eventname, _function)
    {
        if (this.EventListeners[eventname] !== undefined && _function !== undefined) {
            for (let i = 0; i < this.EventListeners[eventname].length; i++) {
                if (this.EventListeners[eventname][i].func === _function || this.EventListeners[eventname][i].name === _function) {
                    this.EventListeners[eventname].splice(i, 1)
                    return true
                }
            }
        } else if (this.EventListeners[eventname] !== undefined) {
            this.EventListeners[eventname] = undefined
            return true
        }

        return false
    }
}