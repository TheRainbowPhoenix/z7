import math

def Unixtime(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: DWord
    # VAR_TEMP:
    #   leapyears: Int
    #   days_from_1970: DInt
    #   days_from_BeginOfYear: Array[0..11] of Int
    #   l_unixtime: DInt
    #   sfc1_ret_val: Int
    #   CDT_systemtime: Date_And_Time
    #   systemtime: Struct
    #   year: Int
    #   month: Int
    #   day: Int
    #   hour: Int
    #   minute: Int
    #   second: Int
    context['leapyears'] = 0
    context['days_from_1970'] = 0
    context['days_from_BeginOfYear'][int(0)] = 0
    context['days_from_BeginOfYear'][int(1)] = 31
    context['days_from_BeginOfYear'][int(2)] = 59
    context['days_from_BeginOfYear'][int(3)] = 90
    context['days_from_BeginOfYear'][int(4)] = 120
    context['days_from_BeginOfYear'][int(5)] = 151
    context['days_from_BeginOfYear'][int(6)] = 181
    context['days_from_BeginOfYear'][int(7)] = 212
    context['days_from_BeginOfYear'][int(8)] = 243
    context['days_from_BeginOfYear'][int(9)] = 273
    context['days_from_BeginOfYear'][int(10)] = 304
    context['days_from_BeginOfYear'][int(11)] = 334
    context['sfc1_ret_val'] = RD_SYS_T(OUT=context['CDT_systemtime'])
    context['year'] = (BCD16_TO_INT(context['systemtime'].year_CDT) + 2000)
    context['month'] = BCD16_TO_INT(context['systemtime'].month_CDT)
    context['day'] = BCD16_TO_INT(context['systemtime'].day_CDT)
    context['hour'] = BCD16_TO_INT(context['systemtime'].hour_CDT)
    context['minute'] = BCD16_TO_INT(context['systemtime'].minute_CDT)
    context['second'] = BCD16_TO_INT(context['systemtime'].second_CDT)
    context['leapyears'] = (((((context['year'] - 1) - 1968) / 4) - (((context['year'] - 1) - 1900) / 100)) + (((context['year'] - 1) - 1600) / 400))
    context['days_from_1970'] = ((((((context['year'] - 1970) * 365) + context['leapyears']) + context['days_from_BeginOfYear'][int(context['month'])]) + context['day']) - 1)
    if ((context['month'] > 2) and (((context['year'] % 4) == 0) and (((context['year'] % 100) != 0) or ((context['year'] % 400) == 0)))):
        context['days_from_1970'] = (context['days_from_1970'] + 1)
    context['l_unixtime'] = (context['second'] + (60 * (context['minute'] + (60 * (context['hour'] + (24 * context['days_from_1970']))))))
    if (context['sfc1_ret_val'] != 0):
        context['Unixtime'] = 0
    else:
        context['Unixtime'] = DINT_TO_DWORD(context['l_unixtime'])
