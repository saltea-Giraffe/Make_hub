; ============================================================
;  Make HUB - Inno Setup インストーラースクリプト
;  Inno Setup 6.x 以上が必要
;  ビルド方法: scripts\build-release.ps1 を実行
; ============================================================

#define AppName      "Make HUB"
#define AppVersion   "1.0.0"
#define AppPublisher "saltea-Giraffe"
#define AppURL       "https://github.com/saltea-Giraffe/Make_hub"
#define AppExeName   "MakeHub"
#define ServiceName  "MakeHub"
#define ServiceDesc  "Make HUB - ショートカットポータル"

; ビルドスクリプトが作成したリリースディレクトリ
#define ReleaseDir   "..\build\release"
#define ToolsDir     "tools"

[Setup]
AppId={{2073213F-220C-4869-AB97-45C696A47029}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}

; インストール先（Program Files）
DefaultDirName={autopf}\{#AppName}
DirExistsWarning=yes
DisableDirPage=no

; プログラムグループ
DefaultGroupName={#AppName}
DisableProgramGroupPage=no

; 出力設定
OutputBaseFilename={#AppExeName}-v{#AppVersion}-Setup
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; インストーラーの外観
WizardStyle=modern
WizardSizePercent=120
SetupIconFile=
; SetupIconFile=assets\icon.ico  ; アイコンファイルがあれば指定

; 管理者権限が必要（サービス登録のため）
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline

; アンインストール情報
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\node\node.exe

; インストール後の再起動不要
RestartIfNeededByRun=no

; その他
ChangesEnvironment=no
ShowLanguageDialog=no
LanguageDetectionMethod=none

[Languages]
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Messages]
WelcomeLabel1=Make HUB セットアップへようこそ
WelcomeLabel2=このプログラムは {#AppName} v{#AppVersion} をインストールします。%n%nインストールを続ける前に、他のアプリケーションをすべて終了することをお勧めします。

[Tasks]
Name: "desktopicon"; Description: "デスクトップにショートカットを作成(&D)"; GroupDescription: "追加タスク:"; Flags: unchecked

[Dirs]
; データディレクトリ（DB・アップロード）は ProgramData に作成
Name: "{commonappdata}\{#AppName}"; Permissions: everyone-full
Name: "{commonappdata}\{#AppName}\uploads"; Permissions: everyone-full

[Files]
; ─── バックエンド ─────────────────────────────────────────────────
Source: "{#ReleaseDir}\backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs createallsubdirs ignoreversion

; ─── フロントエンド ───────────────────────────────────────────────
Source: "{#ReleaseDir}\frontend\*"; DestDir: "{app}\frontend"; Flags: recursesubdirs createallsubdirs ignoreversion

; ─── Node.js ポータブル ───────────────────────────────────────────
Source: "{#ReleaseDir}\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs createallsubdirs ignoreversion

; ─── 起動スクリプト ───────────────────────────────────────────────
Source: "{#ReleaseDir}\start-server.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "wait-and-open.bat"; DestDir: "{app}"; Flags: ignoreversion

; ─── NSSM（サービスマネージャー） ────────────────────────────────
Source: "{#ToolsDir}\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

[INI]
; .env ファイルは Pascal スクリプトで生成（JWT_SECRET をランダム生成）

[Icons]
; スタートメニュー
Name: "{group}\Make HUB を開く";          Filename: "{app}\open-browser.bat";  WorkingDir: "{app}"
Name: "{group}\サービスの管理";            Filename: "{app}\service-manager.bat"; WorkingDir: "{app}"
Name: "{group}\{#AppName} のアンインストール"; Filename: "{uninstallexe}"

; デスクトップ（タスク選択時のみ）
Name: "{autodesktop}\Make HUB"; Filename: "{app}\open-browser.bat"; Tasks: desktopicon

[Run]
; サービスのインストール・起動は CurStepChanged(ssPostInstall) で実施

; ─── インストール完了後: サーバー起動を待ってからブラウザを開く ──
Filename: "{app}\wait-and-open.bat"; Description: "Make HUB をブラウザで開く"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
; サービスの停止と削除
Filename: "{app}\nssm.exe"; Parameters: "stop ""{#ServiceName}"""; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\nssm.exe"; Parameters: "remove ""{#ServiceName}"" confirm"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#AppName}"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveFirewall"

[UninstallDelete]
; ログディレクトリは残す（データは保持）
; データディレクトリ（{commonappdata}\{#AppName}）はユーザーが手動削除

[Code]
// ─── Pascal スクリプト ────────────────────────────────────────────

// JWT シークレットはビルドスクリプト(PowerShell)が生成し
// ISCC の /DJwtSecret=... で渡される
function GetJwtSecret(): String;
begin
  Result := '{#JwtSecret}';
end;

// サービスが存在するかチェック（NSSM status の戻り値で判定）
function ServiceExists(): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{app}\nssm.exe'),
       'status "{#ServiceName}"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // 0=RUNNING, 1=STOPPED, etc. - 255 は "not found"
  Result := (ResultCode <> 255);
end;

// NSSM コマンドを実行するヘルパー
procedure NSSMExec(Params: String);
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{app}\nssm.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

// sc.exe でサービスを強制削除（NSSM が失敗する壊れた状態にも対応）
procedure ForceRemoveService();
var
  ResultCode: Integer;
begin
  // sc stop / delete にはフルパスを使用（インストーラ実行環境での PATH 依存を避ける）
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(3000);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(3000);
  // レジストリからも削除（marked-for-deletion 状態をクリア）
  Exec(ExpandConstant('{sys}\reg.exe'),
       'delete "HKLM\SYSTEM\CurrentControlSet\Services\{#ServiceName}" /f',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

// サービスをインストール・設定・起動
procedure InstallAndStartService(AppDir: String);
var
  DataDir, LogDir: String;
  ResultCode: Integer;
begin
  // cmd.exe はスペースなしパス、AppParameters も単純な引数のみ
  // start-server.bat が %~dp0 で自己解決するため AppParameters のクォート問題が発生しない
  DataDir  := ExpandConstant('{commonappdata}\{#AppName}');
  LogDir   := DataDir + '\logs';

  // 既存サービスを停止・削除
  // まず NSSM で試み、次に sc.exe で強制削除（壊れた状態にも対応）
  NSSMExec('stop "{#ServiceName}"');
  Sleep(2000);
  NSSMExec('remove "{#ServiceName}" confirm');
  Sleep(2000);
  ForceRemoveService();

  // cmd.exe を実行ファイルとして登録し、AppParameters で start-server.bat を呼ぶ
  // AppDirectory がカレントディレクトリになるため bat ファイル名だけで解決できる
  NSSMExec('install "{#ServiceName}" ' + ExpandConstant('{sys}\cmd.exe'));
  NSSMExec('set "{#ServiceName}" AppDirectory "' + AppDir + '"');
  NSSMExec('set "{#ServiceName}" AppParameters /c start-server.bat');
  NSSMExec('set "{#ServiceName}" Description "{#ServiceDesc}"');
  NSSMExec('set "{#ServiceName}" Start SERVICE_AUTO_START');
  NSSMExec('set "{#ServiceName}" AppStdout "' + LogDir + '\stdout.log"');
  NSSMExec('set "{#ServiceName}" AppStderr "' + LogDir + '\stderr.log"');
  NSSMExec('set "{#ServiceName}" AppRotateFiles 1');
  NSSMExec('set "{#ServiceName}" AppRotateBytes 5242880');

  // ファイアウォール: ポート3001をLAN内から許可（既存ルールは削除してから追加）
  Exec(ExpandConstant('{sys}\netsh.exe'),
       'advfirewall firewall delete rule name="{#AppName}"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\netsh.exe'),
       'advfirewall firewall add rule name="{#AppName}" dir=in action=allow protocol=TCP localport=3001',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // 起動
  Sleep(1000);
  NSSMExec('start "{#ServiceName}"');
end;

// インストール後に .env と補助バッチファイルを作成
procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile, LogDir: String;
  JwtSecret: String;
  Port: String;
  DataDir: String;
  FrontendDir: String;
  Lines: TStringList;
begin
  if CurStep = ssPostInstall then
  begin
    Port        := '3001';
    DataDir     := ExpandConstant('{commonappdata}\{#AppName}');
    FrontendDir := ExpandConstant('{app}\frontend');
    JwtSecret   := GetJwtSecret();

    // ログディレクトリ作成
    LogDir := DataDir + '\logs';
    if not DirExists(LogDir) then
      ForceDirectories(LogDir);

    // .env ファイルを生成（上書き不可 - アップグレード時は既存を保持）
    EnvFile := ExpandConstant('{app}\.env');
    if not FileExists(EnvFile) then
    begin
      Lines := TStringList.Create;
      try
        Lines.Add('# Make HUB 設定ファイル');
        Lines.Add('# このファイルを編集後、サービスを再起動してください');
        Lines.Add('');
        Lines.Add('NODE_ENV=production');
        Lines.Add('PORT=' + Port);
        Lines.Add('');
        Lines.Add('# データ保存先（DB・アップロードファイル）');
        Lines.Add('DATA_DIR=' + DataDir);
        Lines.Add('');
        Lines.Add('# フロントエンド静的ファイルのパス');
        Lines.Add('FRONTEND_DIR=' + FrontendDir);
        Lines.Add('');
        Lines.Add('# JWT シークレット（変更する場合は全ユーザーの再ログインが必要）');
        Lines.Add('JWT_SECRET=' + JwtSecret);
        Lines.Add('JWT_EXPIRES=8h');
        Lines.Add('');
        Lines.Add('# CORS（開発環境のフロントエンドURLを許可する場合のみ設定）');
        Lines.Add('# FRONTEND_URL=http://localhost:5173');
        Lines.SaveToFile(EnvFile);
      finally
        Lines.Free;
      end;
    end;

    // ブラウザ起動バッチを生成
    Lines := TStringList.Create;
    try
      Lines.Add('@echo off');
      Lines.Add('start http://localhost:' + Port);
      Lines.SaveToFile(ExpandConstant('{app}\open-browser.bat'));
    finally
      Lines.Free;
    end;

    // サービス管理バッチを生成
    Lines := TStringList.Create;
    try
      Lines.Add('@echo off');
      Lines.Add('echo Make HUB - サービス管理');
      Lines.Add('echo.');
      Lines.Add('echo [1] サービスの状態確認');
      Lines.Add('echo [2] サービスを開始');
      Lines.Add('echo [3] サービスを停止');
      Lines.Add('echo [4] サービスを再起動');
      Lines.Add('echo [5] ブラウザで開く');
      Lines.Add('echo [6] 終了');
      Lines.Add('echo.');
      Lines.Add('set /p choice="番号を入力してください: "');
      Lines.Add('if "%choice%"=="1" "' + ExpandConstant('{app}\nssm.exe') + '" status "{#ServiceName}"');
      Lines.Add('if "%choice%"=="2" "' + ExpandConstant('{app}\nssm.exe') + '" start "{#ServiceName}"');
      Lines.Add('if "%choice%"=="3" "' + ExpandConstant('{app}\nssm.exe') + '" stop "{#ServiceName}"');
      Lines.Add('if "%choice%"=="4" "' + ExpandConstant('{app}\nssm.exe') + '" restart "{#ServiceName}"');
      Lines.Add('if "%choice%"=="5" start http://localhost:' + Port);
      Lines.Add('if "%choice%"=="6" exit');
      Lines.Add('pause');
      Lines.SaveToFile(ExpandConstant('{app}\service-manager.bat'));
    finally
      Lines.Free;
    end;

    // サービスのインストールと起動
    InstallAndStartService(ExpandConstant('{app}'));
  end;
end;

// アンインストール前の確認
function InitializeUninstall(): Boolean;
begin
  Result := MsgBox(
    'Make HUB をアンインストールします。' + #13#10 +
    'データベースとアップロードファイルは保持されます。' + #13#10 + #13#10 +
    '続行しますか？',
    mbConfirmation, MB_YESNO) = IDYES;
end;
