import math

def Split(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   string_in: String
    #   delimeter: String
    #   pointer: Int
    # VAR_IN_OUT:
    #   sub_strings: Array[*] of String
    # VAR_TEMP:
    #   _split: String
    #   _position: Int
    #   _return: String
    context['_position'] = FIND(IN1=context['string_in'], IN2=context['delimeter'])
    if (context['_position'] == 0):
        context['sub_strings'][int(context['pointer'])] = context['string_in']
        return
    context['sub_strings'][int(context['pointer'])] = LEFT(IN=context['string_in'], L=(context['_position'] - 1))
    Split(string_in=RIGHT(IN=context['string_in'], L=(LEN(context['string_in']) - context['_position'])), delimeter=context['delimeter'], pointer=(context['pointer'] + 1), sub_strings=context['sub_strings'])


def String_to_DTL(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: DTL
    # VAR_INPUT:
    #   time_as_string: String
    # VAR_TEMP:
    #   _dtl_components: Array[0..4] of String
    #   _date: String
    #   _time: String
    #   _year: String
    #   _month: String
    #   _day: String
    #   _hour: String
    #   _minute: String
    Split(string_in=context['time_as_string'], delimeter='T', pointer=0, sub_strings=context['_dtl_components'])
    context['_date'] = context['_dtl_components'][int(0)]
    context['_time'] = context['_dtl_components'][int(1)]
    Split(string_in=context['_date'], delimeter='-', pointer=0, sub_strings=context['_dtl_components'])
    context['_year'] = context['_dtl_components'][int(0)]
    context['_month'] = context['_dtl_components'][int(1)]
    context['_day'] = context['_dtl_components'][int(2)]
    Split(string_in=context['_time'], delimeter=':', pointer=0, sub_strings=context['_dtl_components'])
    context['_hour'] = context['_dtl_components'][int(0)]
    context['_minute'] = context['_dtl_components'][int(1)]
    context['String_to_DTL'].YEAR = STRING_TO_UINT(context['_year'])
    context['String_to_DTL'].MONTH = STRING_TO_USINT(context['_month'])
    context['String_to_DTL'].DAY = STRING_TO_USINT(context['_day'])
    context['String_to_DTL'].HOUR = STRING_TO_USINT(context['_hour'])
    context['String_to_DTL'].MINUTE = STRING_TO_USINT(context['_minute'])


def Set_System_Time_from_Web_Page(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   time_as_string: String
    # VAR_TEMP:
    #   _ret_val: Int
    #   _time_as_dtl: DTL
    if (context['time_as_string'] == ''):
        return
    context['_time_as_dtl'] = String_to_DTL(context['time_as_string'])
    context['_ret_val'] = WR_SYS_T(context['_time_as_dtl'])
    context['time_as_string'] = ''
