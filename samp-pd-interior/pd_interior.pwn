// Filterscript: телепорт в интерьер PD + создание кастомной модели.
// Требуется open.mp (AddSimpleModel) или SA-MP 0.3.DL + streamer/ArtworkLoader.
// Модель pd_interior.dff/.txd/.col кладётся в models/ сервера.
#include <open.mp>

#define PD_MODEL_ID   (-1000)          // свободный custom-ID
#define PD_X          (1500.0)         // точка размещения в мире (подберите свободное место)
#define PD_Y          (-1700.0)
#define PD_Z          (1000.0)         // высоко в небе — классический трюк «интерьера»

new gPdObject;

public OnFilterScriptInit()
{
    AddSimpleModel(-1, 19379, PD_MODEL_ID, "pd_interior.dff", "pd_interior.txd");
    gPdObject = CreateObject(PD_MODEL_ID, PD_X, PD_Y, PD_Z, 0.0, 0.0, 0.0, 300.0);
    return 1;
}

public OnFilterScriptExit()
{
    DestroyObject(gPdObject);
    return 1;
}

// Модель стартует в (0,0,0) → вход (юг, дверь x=7) = PD_X+7, PD_Y+1
CMD:pd(playerid)
{
    SetPlayerPos(playerid, PD_X + 7.0, PD_Y + 2.0, PD_Z + 1.0);
    SetPlayerFacingAngle(playerid, 0.0);
    SetCameraBehindPlayer(playerid);
    return 1;
}

// Точки спавна/работы (смещения от PD_X, PD_Y, PD_Z)
// Приём: 7.8,8.6 | Брифинг: 7,21 | Шеф: 18,23 | Допросная: 25.5,22
// Улики: 33,22 | Раздевалка: 19,4 | Оружейная: 19,9.5 | Камеры: 26/30/34, 2.5
