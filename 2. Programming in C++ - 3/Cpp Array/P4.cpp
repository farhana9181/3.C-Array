#include<bits/stdc++.h>
#include<iomanip>
using namespace std;
int main()
{
    int a[14],i,s,s1=0,s2=0,t,t1;
    cout<<"Enter 13 digit for UPC :"<<endl;
    for(i=0;i<13;i++)
    {
        cin>>a[i];
    }
    cout<<endl<<"-> 13 digit for UPC :"<<endl;
    for(i=0;i<13;i++)
    {
        cout<<a[i]<<"  ";
    }
    cout<<endl;
     for(i=0;i<12;i++)
    {
        if(i%2!=0)
        {
            cout<<"3"<<"  ";
        }else
        {
           cout<<"1"<<"  "; 
        }
    }
    cout<<endl<<"______________________________________________________________________________________________________________________________________"<<endl;
    cout<<"After multiplying & add all the multiply numbers are :  ";
      for(i=0;i<12;i++)
    {
        if(i%2!=0)
        {
            s1=s1+a[i]*3;

        }else
        {
           s2=s2+a[i]*1;
        }
    } 
    s=s1+s2;
    cout<<s<<endl;
    cout<<"."<<endl;
    cout<<"."<<endl;
    t1=s%10;
    if(t1>=1 && t1<=9)
    {
        t=10-t1;
        cout<<"Check digit : "<<t<<endl;
    }else
    {
        cout<<"Check digit : 0"<<endl;
    }
    cout<<endl;
}