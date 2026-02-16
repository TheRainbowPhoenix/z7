import math

def DInt_Summation(context, global_dbs):
    # Return Type: UDInt
    # VAR_INPUT:
    #   start_index: DInt
    #   end_index: DInt
    context['DInt.Summation'] = REAL_TO_UDINT((((context['end_index'] - context['start_index']) * ((context['end_index'] - context['start_index']) + 1)) / 2))
    return
