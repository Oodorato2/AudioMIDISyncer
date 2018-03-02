# SMFListener

MIDIの発音タイミングをイベントリスナーのように扱うことができます。
自分用に作りましたが、せっかくなので公開します。

MIDIパーサーには「[miz_music](https://github.com/MizunagiKB/miz_music)」、
それに使われている「[encoding.js](https://github.com/polygonplanet/encoding.js)」を必須ライブラリとして使用しています。

## 一応動くブラウザ
Edge, Chrome, Firefox
※ 草案段階のAPIを使ってるので保証はできません。

## DEMOサイト(仮)
[https://0db.me/test/](https://0db.me/test/)


## 簡単な使い方

```html
<script src="encoding.min.js"></script>
<script src="miz_music.min.js"></script>
<script src="smflistener.js"></script>
```

```js
var instance = new SMFListener(
  "smf.mid", // MIDIファイルを指定
  "audio.mp3" // 同時に再生する音楽ファイルを指定
);

instance.addEventListener('ready', function(){// ファイル読み込み完了後に一度だけ発火
  instance.play();// 再生する
});

instance.addEventListener('NoteAll', function(event){// 音がなるタイミングで発火します。
  if (event.type === 'note') {
    console.log(event);// 渡される引数に情報が入っています。
  }
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
- NoteAll


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