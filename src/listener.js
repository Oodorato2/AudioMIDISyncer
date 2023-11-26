import { AMC } from './amc'

export class Listener
{
    /**
     * @type {{
     *  audioSync: Boolean,
     *  renderTimeShift: Number,
     * }}
     */
    #options = {
        audioSync: true,
        renderTimeShift: 0,
    }

    #inOptions = {}

    #fileLoadingState = {
        preparing: 0,
        ready: 0,
    }

    #player = {
        currentTime: -1,
        timeStamp: 0,
        startTimeStamp: 0,
        status: 'stop',
    }

    #eventListeners = {}

    #SMF
    AMC

    #Audio
    #AudioContext
    #AudioBuffer
    #AudioSource

    #Anime

    constructor (SMF, Audio, options)
    {
        this.#sets(SMF, Audio, options)
        this.#loadfiles()
    }

    #sets (SMF, Audio, options)
    {
        this.#setOptions(options)
        this.#setFiles(SMF, Audio)
        this.#setupEventListener()
    }

    #setOptions (options)
    {
        this.#inOptions = options
        if (options !== undefined) {
            if (typeof(options) === 'object' && options !== null) {
                for (let option in options) {
                    if (this.#options[option] !== undefined) {
                        this.#options[option] = options[option]
                    }
                }
            }
        }
    }

    #setFiles (SMF, Audio)
    {
        this.#setSMF(SMF)
        this.#setAudio(Audio)
    }

    #setSMF (SMF)
    {
        this.#SMF = SMF
    }

    #setAudio (Audio)
    {
        this.#Audio = Audio
    }

    async #setAMC (arrayBuffer)
    {
        this.AMC = new AMC()
        await this.AMC.setup(arrayBuffer)
    }
 
    async #loadfiles (SMF, Audio)
    {
        this.#filePreparing()
        await this.#loadSMF(SMF)
        await this.#loadAudio(Audio)
        this.#fileReady()
    }

    async #loadSMF (SMF)
    {
        if (this.#player.status === 'play' || this.#player.status === 'pause') {
            this.stop()
        }
        if (SMF === undefined) {
            SMF = this.#SMF
        }
        this.#filePreparing()
        try {

            let
                MIDIOriSource = null

            if (typeof(SMF) === 'string' && SMF !== '') {
                MIDIOriSource = SMF
            } else if (SMF instanceof HTMLElement && SMF.type === 'file' && SMF.files.length) {
                MIDIOriSource = URL.createObjectURL(SMF.files[0])
            } else if (SMF instanceof File && SMF) {
                MIDIOriSource = URL.createObjectURL(SMF)
            }

            if (MIDIOriSource) {
                let response = await fetch(MIDIOriSource)
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                await this.#setAMC(await response.arrayBuffer())
            } else {
                this.#options.audioSync = false
            }
            
        } catch (error) {
            console.error(error)
        }
        this.#fileReady()
    }

    async #loadAudio (Audio)
    {
        if (this.#player.status === 'play' || this.#player.status === 'pause') {
            this.stop()
        }
        if (this.#AudioContext) {
            await this.#AudioContext.close()
        }
        this.#AudioContext = new (window.AudioContext || window.webkitAudioContext || window.Audio)()
        this.#AudioBuffer = undefined
        this.#AudioSource = undefined
        if (Audio === undefined) {
            Audio = this.#Audio
        }
        this.#filePreparing()
        try {

            let
                AudioOriSource = null

            if (typeof(Audio) === 'string' && Audio !== '') {
                AudioOriSource = Audio
            } else if (Audio instanceof HTMLElement && Audio.type === 'file' && Audio.files.length) {
                AudioOriSource = URL.createObjectURL(Audio.files[0])
            } else if (Audio instanceof File && Audio) {
                AudioOriSource = URL.createObjectURL(Audio)
            }

            if (AudioOriSource)
            {
                let
                    response,
                    arrayBuffer

                response = await fetch(AudioOriSource),
                arrayBuffer = await response.arrayBuffer()
                this.#AudioBuffer = await this.#AudioContext.decodeAudioData(arrayBuffer)
            } else {
                this.#options.audioSync = false
            }

        } catch (error) {
            console.error(error)
        }
        this.#fileReady()
    }

    #setAudioSource ()
    {
        if (this.#AudioBuffer) {
            this.#AudioSource = this.#AudioContext.createBufferSource()
            this.#AudioSource.buffer = this.#AudioBuffer
            this.audioNodeConnects(this.#AudioContext, this.#AudioSource)
        }
    }

    /**
     * オーディオソースをオーディオコンテキストのデスティネーションに接続します。
     * 
     * @param {AudioContext} AudioContext 接続するオーディオコンテキスト。
     * @param {AudioSourceNode} AudioSource 接続するオーディオソース。
     * 
     * @private
     */
    audioNodeConnects (AudioContext, AudioSource)
    {
        AudioSource.connect(AudioContext.destination)
    }

    #filePreparing ()
    {
        this.removeEventListener('render', '_this_midiEventlisteners')
        this.#fileLoadingState.preparing += 1
    }

    #fileReady ()
    {
        this.#fileLoadingState.ready += 1
        if (this.#fileLoadingState.ready === this.#fileLoadingState.preparing) {
            this.#setAudioSource()
            this.#actionEventListener('ready')
            if(this.#Anime !== undefined) {
                cancelAnimationFrame(this.#Anime)
            }
            if(this.AMC !== undefined) {
                this.addEventListener('render', () => this.#midiEventlisteners(), '_this_midiEventlisteners')
            }
            this.#Anime = requestAnimationFrame((timeStamp) => this.#render(timeStamp))
        }
    }

    #setupEventListener ()
    {
        this.#eventListeners = {}
    }

    #actionEventListener (eventname, _arguments)
    {
        if (this.#eventListeners[eventname] !== undefined) {
            if (0 < this.#eventListeners[eventname].length) {
                if (_arguments === undefined) {
                    _arguments = []
                }
                for (let i = 0; i < this.#eventListeners[eventname].length; i++) {
                    if (this.#eventListeners[eventname][i] !== undefined) {
                        try {
                            this.#eventListeners[eventname][i].func.apply(this, _arguments)
                        } catch (error) {
                            console.error(error)
                        }
                    }
                }
            }
        }
    }

    #listenerNoteEvent (event, time)
    {
        // 音符イベント
        if (event.onTime > time) {

            // Before sounding a note.

            if (event.act !== 0) {
                this.#actionEventListener('onlyOnceNoteBeforeSounding', [event, time])// 1度のみ検知
                event.act = 0
            }

            this.#actionEventListener('noteBeforeSounding', [event, time])// 常時検知

        } else if (event.onTime <= time && event.offTime > time) {

            // Sounding the note.

            if (event.act !== 1) {
                this.#actionEventListener('onlyOnceNoteSounding', [event, time])// 1度のみ検知
                event.act = 1
            }

            this.#actionEventListener('noteSounding', [event, time])// 常時検知

        } else if (event.offTime <= time) {

            // After sounding a note.

            if (event.act !== 2) {
                this.#actionEventListener('onlyOnceNoteAfterSounding', [event, time])// 1度のみ検知
                event.act = 2
            }

            this.#actionEventListener('noteAfterSounding', [event, time])// 常時検知

        }
    }

    #listenerEvent (event, time, eventTypeName = 'Event')
    {
        // イベント
        if (event.msTime > time) {

            // Before event.

            if (event.act !== 0) {
                this.#actionEventListener('onlyOnceBefore'+eventTypeName, [event, time])// 1度のみ検知
                event.act = 0
            }

            this.#actionEventListener('before'+eventTypeName, [event, time])// 常時検知

        } else if (event.msTime <= time) {

            // After event.

            if (event.act !== 2) {
                this.#actionEventListener('onlyOnceAfter'+eventTypeName, [event, time])// 1度のみ検知
                event.act = 2
            }

            this.#actionEventListener('after'+eventTypeName, [event, time])// 常時検知

        }
    }

    #midiEventlisteners ()
    {
        // NoteEventsListener
        for (let i = 0; i < this.AMC.notes.length; i++) {
            this.#listenerNoteEvent(this.AMC.notes[i], this.#player.currentTime)
        }

        // PitchEventsListener
        for (let i = 0; i < this.AMC.pitchs.length; i++) {
            this.#listenerEvent(this.AMC.pitchs[i], this.#player.currentTime, 'PitchEvent')
        }
    }

    #render (timeStamp)
    {
        if (this.#options.audioSync) {
            this.#player.timeStamp = this.#AudioContext.currentTime * 1000
        } else {
            this.#player.timeStamp = timeStamp
        }
        if (this.#player.status === 'play') {
            this.#player.currentTime = this.#player.timeStamp - this.#player.startTimeStamp + this.#options.renderTimeShift
        }
        this.#actionEventListener('render', [timeStamp])
        this.#Anime = requestAnimationFrame((timeStamp) => this.#render(timeStamp))
        if (this.#player.status === 'play' && this.getEndTime() < this.#player.currentTime) {
            this.stop()
        }
    }

    #getUniqueStr (strong = 1000)
    {
        return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
    }

    // --------------------------------------------------------
    // ---------- public methods ------------------------------
    // --------------------------------------------------------

    /**
     * 再読み込みを行います。
     * 
     * @param {String|HTMLElement|File} SMF MIDIファイル
     * @param {String|HTMLElement|File} Audio 音楽ファイル
     * @param {Object} options 設定オブジェクト
     * 
     * @return {Promise}
     */
    async reload(SMF = null, Audio = null, options = {})
    {
        options = {...this.#options, ...options}
        this.#setOptions(options)

        if (SMF === null) {
            SMF = this.#SMF
        }
        if (Audio === null) {
            Audio = this.#Audio
        }
        this.#setFiles(SMF, Audio)

        await this.#loadfiles()
    }

    /**
     * 音楽・MIDIを再生します。player.statusをplayにします。
     * player.statusがpause状態の場合、一時停止した位置から再生します。
     * 
     * @param {Number} startTime 再生開始秒数(Ms) pause状態の場合は無効です。
     */
    play (startTime = 0)
    {
        if (this.#player.status === 'pause') {
            startTime = this.#player.currentTime
        }
        if (this.#AudioSource) {
            this.#AudioSource.start(this.#AudioContext.currentTime, startTime/1000)
        }
        this.#player.status = 'play'
        this.#player.startTimeStamp = this.#player.timeStamp - startTime
        this.#actionEventListener('playerPlay')
    }

    /**
     * 音楽・MIDIを一時停止します。player.statusをpauseにします。
     */
    pause ()
    {
        if (this.#player.status === 'play') {
            if (this.#AudioSource) {
                this.#AudioSource.stop()
                this.#setAudioSource()
            }
            this.#player.status = 'pause'
            this.#player.currentTime = this.#player.timeStamp - this.#player.startTimeStamp
            this.#actionEventListener('playerPause')
        }
    }

    /**
     * 音楽・MIDIを停止します。player.statusをstopにします。
     */
    stop ()
    {
        if (this.#AudioSource && this.#player.status === 'play') {
            this.#AudioSource.stop()
            this.#setAudioSource()
        }
        this.#player.status = 'stop'
        this.#player.startTimeStamp = 0
        this.#actionEventListener('playerStop')
    }

    /**
     * イベントリスナーを追加します。
     * 
     * @param {String} eventname イベント名。
     * @param {Function} _function イベントが発生したときに実行されるコールバック関数。
     * @param {String} funcName イベントリスナー名。指定されない場合は、一意の名前が生成されます。
     * 
     * @return {String} イベントリスナー名。
     */
    addEventListener (eventname, _function, funcName)
    {
        if (this.#eventListeners[eventname] === undefined) {
            this.#eventListeners[eventname] = []
        }
        if (!funcName) {
            funcName = this.#getUniqueStr()
        }
        this.#eventListeners[eventname].push({
            name: funcName,
            func: _function,
        })

        return funcName
    }

    /**
     * 指定されたイベントリスナーを削除します。
     * 
     * @param {String} eventname イベントの名前。
     * @param {Function|String} _function 削除するイベントリスナー。関数そのものまたはリスナーの名前を指定します。
     * 
     * @returns {Boolean} リスナーが正常に削除された場合は true、そうでない場合は false。
     */
    removeEventListener (eventname, _function)
    {
        if (this.#eventListeners[eventname] !== undefined && _function !== undefined) {
            for (let i = 0; i < this.#eventListeners[eventname].length; i++) {
                if (this.#eventListeners[eventname][i].func === _function || this.#eventListeners[eventname][i].name === _function) {
                    this.#eventListeners[eventname].splice(i, 1)
                    return true
                }
            }
        } else if (this.#eventListeners[eventname] !== undefined) {
            this.#eventListeners[eventname] = undefined
            return true
        }

        return false
    }

    /**
     * オーディオノード接続のためのカスタムコールバック関数を設定します。
     * 
     * @param {Function(AudioContext, AudioSourceNode):void} callback オーディオノード接続を処理するためのコールバック関数。
     */
    setAudioNodeConnects (callback)
    {
        this.audioNodeConnects = callback
    }

    getPlayerStatus ()
    {
        return this.#player.status
    }

    isPlayerStatus (status)
    {
        return (this.getPlayerStatus() === status)
    }

    getPlayerCurrentTime()
    {
        return this.#player.currentTime
    }

    getCurrentTempo()
    {
        return this.AMC.toMsStepTemop(Math.max(this.getPlayerCurrentTime(), 0)).tempo
    }

    getEndTime()
    {
        let
            amcEndTime = 0,
            audioEndTime = 0

        if (this.AMC) {
            amcEndTime = this.AMC.endTime
        }
        if (this.#AudioSource) {
            audioEndTime = this.#AudioSource.buffer.duration * 1000
        }

        return Math.max(amcEndTime, audioEndTime)
    }
}