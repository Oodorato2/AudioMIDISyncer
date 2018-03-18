/*
  SMFListener
  Copyright (c) 2018 オオドラ(Oodorato2)
  https://github.com/Oodorato2/SMFListener
  License MIT
*/

class SMFListener {

  constructor(SMF, Audio, options) {
    this.sets(SMF, Audio, options);
    this.loadfiles();
  }

  sets(SMF, Audio, options) {
    this.setOptions(options);
    this.setFiles(SMF, Audio);
    this.AudioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.requestAnimationFrame = (function() {
      return (
          window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame
      ).bind(window);
    })();
    this.cancelAnimationFrame = (function() {
      return (
          window.cancelAnimationFrame       ||
          window.webkitCancelAnimationFrame ||
          window.mozCancelAnimationFrame    ||
          window.oCancelAnimationFrame      ||
          window.msCancelAnimationFrame
      ).bind(window);
    })();
    this.fileLoadingState = {
      preparing: 0,
      ready: 0,
    };
    this.setupEventListener();
    this.player = {
      currentTime: -1,
      timeStamp: 0,
      startTimeStamp: 0,
      pauseTime: 0,
      status: 'stop'
    };
  }

  setOptions(options) {
    this.options = {
      audioSync: true,
    };
    if (options !== undefined) {
      if (typeof(options) === 'object' && options !== null) {
        for (let option in options) {
          if (this.options[option] !== undefined) {
            this.options[option] = options[option];
          }
        }
      }
    }
  }

  setFiles(SMF, Audio) {
    this.setSMF(SMF);
    this.setAudio(Audio);
  }

  setSMF(SMF) {
    this.SMF = SMF;
  }

  setAudio(Audio) {
    this.Audio = Audio;
  }
 
  loadfiles(SMF, Audio) {
    this.filePreparing();
    this.loadSMF(SMF);
    this.loadAudio(Audio);
    setTimeout(()=>this.fileReady(), 500);
  }

  loadSMF(SMF) {
    if (this.player.status === 'play'||this.player.status === 'pause') {this.stop();}
    if (SMF === undefined) {SMF = this.SMF;}
    if (typeof(SMF) === 'string' && SMF !== '') {
      this.filePreparing();
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', SMF, true);
      xhr.onload = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          this.SMFSource = music_reader(xhr.response);
          this.setMidi();
          this.fileReady();
        } else {
          this.options.audioSync = false;
        }
      };
      xhr.send(null);
    } else if (SMF instanceof HTMLElement && SMF.type === 'file' && SMF.files.length) {
      this.filePreparing();
      let reader = new FileReader();
      reader.onload = (e) => {
        this.SMFSource = music_reader(e.target.result);
        this.setMidi();
        this.fileReady();
      }
      reader.readAsArrayBuffer(SMF.files[0]); 
    }
  }

  loadAudio(Audio) {
    if (this.player.status === 'play'||this.player.status === 'pause') {this.stop();}
    this.AudioBuffer = undefined;
    if (Audio === undefined) {Audio = this.Audio;}
    if (typeof(Audio) === 'string' && Audio !== '') {
      this.filePreparing();
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', Audio, true);
      xhr.onload = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          this.AudioContext.decodeAudioData(xhr.response, (buffer) => {
            this.AudioBuffer = buffer;
            this.fileReady();
          });
        } else {
          this.options.audioSync = false;
        }
      };
      xhr.send(null);
    } else if (Audio instanceof HTMLElement && Audio.type === 'file' && Audio.files.length) {
      this.filePreparing();
      let reader = new FileReader();
      reader.onload = (e) => {
        this.AudioContext.decodeAudioData(e.target.result, (buffer) => {
          this.AudioBuffer = buffer;
          this.fileReady();
        });
      }
      reader.readAsArrayBuffer(Audio.files[0]); 
    } else {
      this.options.audioSync = false;
    }
  }

  createAudioSource() {
    this.AudioSource = this.AudioContext.createBufferSource();
    this.AudioSource.buffer = this.AudioBuffer;
    this.AudioSource.connect(this.AudioContext.destination);
  }

  filePreparing() {
    this.removeEventListener('render', ()=>this.NotesListener());
    this.fileLoadingState.preparing += 1;
  }

  fileReady() {
    this.fileLoadingState.ready += 1;
    if (this.fileLoadingState.ready === this.fileLoadingState.preparing) {
      this.actionEventListener('ready');
      if(this.anime !== undefined) {
        this.cancelAnimationFrame(this.anime);
      }
      if(this.MIDI !== undefined) {
        this.addEventListener('render', ()=>this.NotesListener());
      }
      this.render();
    }
  }

  setupEventListener() {
    this.EventListeners = {};
  }

  setMidi() {
    this.MIDI = {
      resolution: this.SMFSource.m_nTimeDiv,
      tempos: [],
      track: []
    }
    this.setMidiTempos();
    this.setMidiNots();
  }

  setMidiTempos() {
    for (let track of this.SMFSource.m_listTrack) {
      for (let i = 0, tick = 0, step = 0; i < track.m_listData.length; i++) {
        tick += track.m_listData[i].m_nStep;
        step += track.m_listData[i].m_nStep;
        if (track.m_listData[i].m_eMMsg === 255 && track.m_listData[i].m_eMEvt === 81) {
          this.MIDI.tempos.push({
            tempo: this.toTempo(track.m_listData[i].m_numValue),
            data: track.m_listData[i].m_numValue,
            tick: tick,
            step: step,
          });
          step = 0;
        }
      }
    }
    this.MIDI.tempos.sort(function(a,b){
      if(a.tick < b.tick) return -1;
      if(a.tick > b.tick) return 1;
      return 0;
    });
    for (let i = 0; i < this.MIDI.tempos.length; i++) {
      if (i === 0) {
        this.MIDI.tempos[i].ms = 0;
      }
      if (i+1 < this.MIDI.tempos.length) {
        this.MIDI.tempos[i+1].ms = (((this.MIDI.tempos[i+1].step) * (this.MIDI.tempos[i].data / this.MIDI.resolution))/1000) + this.MIDI.tempos[i].ms;
      }
    }
  }

  setMidiNots() {
    for (let t = 0, noteNum = 0; t < this.SMFSource.m_listTrack.length; t++) {
      this.MIDI.track.push([]);
      for (let i = 0, tick = 0; i < this.SMFSource.m_listTrack[t].m_listData.length; i++) {
        tick += this.SMFSource.m_listTrack[t].m_listData[i].m_nStep;
        if (this.SMFSource.m_listTrack[t].m_listData[i].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_ON && this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[2] > 0) {

          let onTime = this.toTickMs(tick),
          offTime = undefined,
          step = 0;
          for (let ii = i+1, tickI = tick; ii < this.SMFSource.m_listTrack[t].m_listData.length; ii++) {
            step += this.SMFSource.m_listTrack[t].m_listData[ii].m_nStep;
            tickI += this.SMFSource.m_listTrack[t].m_listData[ii].m_nStep;
            if (this.SMFSource.m_listTrack[t].m_listData[ii].get === undefined && (this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_ON || this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_OF)) {
              if ((this.SMFSource.m_listTrack[t].m_listData[ii].m_aryValue[2] === 0 || this.SMFSource.m_listTrack[t].m_listData[ii].m_eMMsg === miz.music.E_MIDI_MSG.NOTE_OF) && this.SMFSource.m_listTrack[t].m_listData[ii].m_aryValue[1] === this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[1]) {
                this.SMFSource.m_listTrack[t].m_listData[ii].get = true;
                offTime = this.toTickMs(tickI);
                break;
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
                onTime: onTime
              }
            });
            break;
          }

          this.MIDI.track[t].push({
            tick: tick,
            onTime: onTime,
            offTime: offTime,
            channel: (this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[0] & 0x0F),
            type: 'note',
            scale: this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[1],
            velocity: this.SMFSource.m_listTrack[t].m_listData[i].m_aryValue[2],
            step: step,
            noteNum: noteNum,
            act: 0,
          });

          noteNum++;
        }
      }
    }
  }

  getStartStepTempo() {
    let result = 0;
    if (this.MIDI.tempos) {
      for (let tempo of this.MIDI.tempos) {
        if (tempo.tick === this.MIDI.tempos[0].tick) {
          result = tempo.data;
        }
      }
    }
    return result;
  }

  getStartTempo() {
    return this.toTempo(this.getStartStepTempo());
  }

  isNextTempo(i, tick) {
    if (i+1 >= this.MIDI.tempos.length) {
      return 1;
    } else if (this.MIDI.tempos[i+1].tick > tick) {
      return 1;
    } else {
      return 0;
    }
  }

  isNextTempoMs(i, Ms) {
    if (i+1 >= this.MIDI.tempos.length) {
      return 1;
    } else if (this.MIDI.tempos[i+1].ms > Ms) {
      return 1;
    } else {
      return 0;
    }
  }

  toTempo(StepTemop) {
    var _pow = Math.pow( 10 , 3 );
    return Math.round(((60 * 1000 * 1000) / StepTemop) * _pow) / _pow;
  }

  // tickからその時のステップテンポを取得
  toTickStepTemop(tick) {
    return this.toTickTemopData(tick).data;
  }

  toTickTemop(tick) {
    return this.toTempo(this.toTickStepTemop(tick));
  }

  toTickTemopData(tick) {
    let result = false;
    for (let i = 0, ftstep = 0; i < this.MIDI.tempos.length; i++) {
      if (this.MIDI.tempos[i].tick <= tick && this.isNextTempo(i, tick)) {
        for (let tempo of this.MIDI.tempos) {
          if (tempo.tick === this.MIDI.tempos[i].tick) {
            result = tempo;
          }
        }
        return result;
      }
    }
  }

  toMsStepTemop(Ms) {
    let result = false;
    for (let i = 0, ftstep = 0; i < this.MIDI.tempos.length; i++) {
      if (this.MIDI.tempos[i].ms <= Ms && this.isNextTempoMs(i, Ms)) {
        for (let tempo of this.MIDI.tempos) {
          if (tempo.ms === this.MIDI.tempos[i].ms) {
            result = tempo;
          }
        }
        return result;
      }
    }
  }

  toTickMs(tick) {
    return (((tick - this.toTickTemopData(tick).tick) * (this.toTickStepTemop(tick) / this.MIDI.resolution))/1000) + this.toTickTemopData(tick).ms;
  }

  toMsTick(Ms) {
    if(Ms<0){Ms=0;}
    return ((Ms - this.toMsStepTemop(Ms).ms) / ((this.toMsStepTemop(Ms).data / this.MIDI.resolution)/1000)) + this.toMsStepTemop(Ms).tick;
  }

  actionEventListener(eventname, _arguments) {
    if (this.EventListeners[eventname] !== undefined) {
      if (0 < this.EventListeners[eventname].length) {
        if (_arguments === undefined) {
          _arguments = [];
        }
        for (let event of this.EventListeners[eventname]) {
          if (event !== undefined) {
            event.apply(this, _arguments);
          }
        }
      }
    }
  }

  resetNoteAct() {
    for (let track of this.MIDI.track) {
      for (let i = 0; i < track.length; i++) {
        track[i].act = 0;
      }
    }
  }

  loopNotes(callback) {
    for (let t = 0; t < this.MIDI.track.length; t++) {
      for (let n = 0; n < this.MIDI.track[t].length; n++) {
        callback(this.MIDI.track[t][n]);
      }
    }
  }

  NotesListener() {
    let time = this.player.currentTime;
    this.loopNotes((event) => {
      if (event.type === 'note') {
        if (event.onTime <= time && event.act === 0) {
          this.actionEventListener('AllOnNote', [event]);
          event.act = 1;
        } else if (event.onTime > time && (event.act === 1 || event.act === 2)) {
          this.actionEventListener('AllOffNote', [event]);
          this.actionEventListener('AllOffNoteBefore', [event]);
          event.act = 0;
        } else if (event.offTime <= time && event.act !== 2) {
          this.actionEventListener('AllOffNote', [event]);
          this.actionEventListener('AllOffNoteAfter', [event]);
          event.act = 2;
        }
      }
    });
  }

  render(timeStamp) {
    if (this.options.audioSync) {
      this.player.timeStamp = this.AudioContext.currentTime * 1000;
    } else {
      this.player.timeStamp = timeStamp;
    }
    if (this.player.status === 'play') {
      this.player.currentTime = this.player.timeStamp - this.player.startTimeStamp;
    }
    this.actionEventListener('render');
    this.anime = this.requestAnimationFrame((timeStamp)=>this.render(timeStamp));
  }

  // 以下外部からのアクセス許可

  play() {
    let starttime = 0;
    if (this.player.status === 'stop') {this.resetNoteAct();}
    if (this.player.status === 'pause') {starttime = this.player.currentTime;}
    if (this.AudioBuffer) {
      this.createAudioSource();
      this.AudioSource.start(this.AudioContext.currentTime, starttime/1000);
    }
    this.player.status = 'play';
    this.player.startTimeStamp = this.player.timeStamp - starttime;
    this.actionEventListener('playerPlay');
  }

  pause() {
    if (this.player.status === 'play') {
      if (this.AudioBuffer){this.AudioSource.stop();}
      this.player.status = 'pause';
      this.actionEventListener('playerPause');
    }
  }

  stop() {
    if (this.AudioBuffer){this.AudioSource.stop();}
    this.player.status = 'stop';
    this.player.startTimeStamp = 0;
    this.player.currentTime = -1;
    this.actionEventListener('playerStop');
  }

  addEventListener(eventname, _function) {
    if (this.EventListeners[eventname] === undefined) {
      this.EventListeners[eventname] = [];
    }
    this.EventListeners[eventname].push(_function);
  }

  removeEventListener(eventname, _function) {
    if (this.EventListeners[eventname] !== undefined && _function !== undefined) {
      for (let i = 0; i < this.EventListeners[eventname].length; i++) {
        if (this.EventListeners[eventname][i] === _function) {
          this.EventListeners[eventname][i] = undefined;
        }
      }
    } else if (this.EventListeners[eventname] !== undefined) {
      this.EventListeners[eventname] = undefined;
    }
  }

}