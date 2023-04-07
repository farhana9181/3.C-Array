#include <iostream>
using namespace std;
int main ()
{
    int  id, unit , charge;
    float  tk;

    cout<<"Enter Customer ID = " ;
    cin>>id;
    cout<< "Input unit = ";
    cin>> unit;

    if(unit<= 199)
    {
        charge= unit * 1.20;
    }else if (unit==200 && unit <400)
    {
        charge= unit * 1.50;
    }else if (unit==400 && unit <600)
    {
        charge= unit * 1.80;
    }else if (unit>=600 )
    {
        charge= unit * 2.00;
    }
    cout<<"Customer ID No : "<< id<<endl;
    cout<<"Unit Consumed : "<< unit<<endl;
    cout << "Amount Charges :"<<charge << "taka";
}

