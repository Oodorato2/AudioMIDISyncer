import { AMC } from './amc'

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

    async setAMC (arrayBuffer)
    {
        this.AMC = new AMC()
        await this.AMC.setup(arrayBuffer)
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
                try {
                    await this.setAMC(await response.arrayBuffer())
                } catch (error) {
                    console.error(error)
                }
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
            if(this.AMC !== undefined) {
                this.addEventListener('render', () => this.NotesListener(), '_this_NotesListener')
            }
            this.anime = requestAnimationFrame((timeStamp) => this.render(timeStamp))
        }
    }

    setupEventListener ()
    {
        this.EventListeners = {}
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
        for (let i = 0; i < this.AMC.notes.length; i++) {
            callback(this.AMC.notes[i])
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

    getUniqueStr (strong = 1000)
    {
        return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
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
            funcName = this.getUniqueStr()
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