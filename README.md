# SMFListener

MIDIの発音タイミングをイベントリスナーのように扱うことができます。
自分用に作りましたが、せっかくなので公開します。

MIDIパーサーには「[miz_music](https://github.com/MizunagiKB/miz_music)」、
それに使われている「[encoding.js](https://github.com/polygonplanet/encoding.js)」を必須ライブラリとして使用しています。

## 動いてくれるはずのブラウザ
最新の
IE, Edge, Chrome, Firefox

## DEMO
[デモ1](https://sound.0db.me/midi-anime/ripple/)
[デモ2](https://sound.0db.me/midi-anime/pianoroll/)


## 簡単な使い方

```html
<script src="smflistener.min.js"></script>
```

```js
var instance = new SMFListener(
  "smf.mid", // MIDIファイルを指定
  "audio.mp3" // 同時に再生する音楽ファイルを指定
);

instance.addEventListener('ready', function(){// ファイル読み込み完了後に一度だけ発火
  instance.play();// 再生する
});

instance.addEventListener('AllOnNote', function(event){// 音がなるタイミングで発火します。
  console.log(event);// 渡される引数に情報が入っています。
});
```



## メソッド

### イベントリスナー
```js
instance.addEventListener(type, callback);
```
イベントリスナーのタイプ
- ready
- render
- AllOnNote
- AllOffNote


### 再生
```js
instance.play();
```

### 停止
```js
instance.stop();
```



## License
MIT
